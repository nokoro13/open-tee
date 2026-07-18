import { sortCourseTees, type CourseTeeInput } from "@/lib/course-tees";
import {
  DEFAULT_SCORECARD_HANDICAP_ROWS,
  ocrRowLabelForHandicapRow,
  sortScorecardHandicapRows,
  type ScorecardHandicapRowInput,
  type ScorecardHandicapRowKey,
} from "@/lib/scorecard-handicap-rows";
import { isScorecardImageUrl } from "@/lib/scorecard-image-url";

export type ScorecardOcrHole = {
  holeNumber: number;
  par: number;
  strokeIndex: string;
  ladiesStrokeIndex: string;
  teeYardages: Record<string, string>;
};

export type ScorecardSectionTotalsValidation = {
  frontSum: number | null;
  frontExpected: number | null;
  frontMatches: boolean;
  backSum: number | null;
  backExpected: number | null;
  backMatches: boolean;
  totalSum: number | null;
  totalExpected: number | null;
  totalMatches: boolean;
};

export type ScorecardParValidation = ScorecardSectionTotalsValidation;

export type ScorecardYardageValidation = {
  teeKey: string;
  teeName: string;
  totals: ScorecardSectionTotalsValidation;
};

export type ScorecardStrokeIndexValidation = {
  label: string;
  sum: number | null;
  expectedSum: number;
  isValidPermutation: boolean;
};

export type ScorecardOcrResult = {
  tees: CourseTeeInput[];
  holes: ScorecardOcrHole[];
  parValidation: ScorecardParValidation | null;
  yardageValidation: ScorecardYardageValidation[];
  handicapValidation: ScorecardStrokeIndexValidation[];
};

type SpreadsheetGrid = {
  columns?: string[];
  rows?: Record<string, (number | null)[] | undefined>;
  warnings?: string[];
};

type HandicapRowPayload = {
  values?: (number | null)[];
};

type LadiesHandicapByHolePayload = {
  ladiesHandicapByHole?: Record<string, number | null>;
};

const MIN_YARDAGE = 70;
const MAX_YARDAGE = 700;
const TOTAL_TOLERANCE = 3;
const OCR_MODEL = process.env.SCORECARD_OCR_MODEL?.trim() || "gpt-4o";

const NON_HOLE_COLUMNS = new Set([
  "OUT",
  "IN",
  "TOT",
  "TOTAL",
  "NET",
  "INITIALS",
  "INT",
  "RATING",
  "SLOPE",
]);

const TEE_ROW_ALIASES: Record<string, string[]> = {
  blue: ["BLUE"],
  white: ["WHITE"],
  black: ["BLACK"],
  red: ["RED"],
  gold: ["GOLD"],
};

const CANONICAL_18_COLUMNS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "OUT",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "IN",
  "TOT",
] as const;

const GRID_SYSTEM_PROMPT = `You read golf scorecard images as a spreadsheet grid.

Column headers for 18-hole cards are always:
1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT

Each stat is its own row (BLUE, WHITE, RED, PAR, etc.).
Cell value = row ∩ column intersection.
Skip the rating/slope label column on the far left.

Rules:
- Every row array length MUST equal columns.length (21 for 18-hole cards).
- Read left-to-right, one value per column, index-for-index with columns.
- Use null for unreadable cells — never guess or shift values.`;

const MENS_HANDICAP_ROW_SYSTEM_PROMPT = `You read the MEN'S HDCP row from a golf scorecard.

The column headers are fixed (same as tee yardage rows):
1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT

Read the MEN'S HDCP / MEN'S HCP row exactly like a tee yardage row:
- One cell per column, left to right, 21 values total
- Hole N handicap = cell under column header "N"
- OUT, IN, TOT are blank → use null at those three positions
- Do NOT skip blank OUT/IN/TOT — keep all 21 slots so column "11" stays at index 11

Never read handicaps as a compressed list of 18 numbers.`;

const LADIES_HANDICAP_ROW_SYSTEM_PROMPT = `You read the LADIES' HDCP row from a golf scorecard.

The LADIES' HDCP row is a separate row below MEN'S HDCP. It has DIFFERENT numbers.

Column headers (fixed, same as tee rows):
1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT

Read ONLY the LADIES' HDCP / LADIES HCP / LADIES HDCP row:
- One cell per column, left to right, 21 values total
- Hole N ladies handicap = cell under column header "N" on the LADIES row
- OUT, IN, TOT are blank on the ladies row → use null at those three positions
- Do NOT read from MEN'S HDCP — that is the row above with different values
- Do NOT skip blank OUT/IN/TOT — keep all 21 slots

Never read handicaps as a compressed list of 18 numbers.`;

function canonicalScorecardColumns(holeCount: number): string[] {
  if (holeCount === 18) return [...CANONICAL_18_COLUMNS];
  return Array.from({ length: holeCount }, (_, index) => String(index + 1));
}

function expectedStrokeIndexSum(holeCount: number): number {
  return (holeCount * (holeCount + 1)) / 2;
}

function normalizeColumnLabel(raw: string): string {
  const trimmed = raw.trim().toUpperCase().replace(/['']/g, "'");
  if (NON_HOLE_COLUMNS.has(trimmed)) return trimmed;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 18) {
    return String(parsed);
  }
  return trimmed;
}

function isHoleColumn(column: string): boolean {
  const normalized = normalizeColumnLabel(column);
  if (NON_HOLE_COLUMNS.has(normalized)) return false;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 18;
}

function holeNumberFromColumn(column: string): number | null {
  if (!isHoleColumn(column)) return null;
  return Number.parseInt(normalizeColumnLabel(column), 10);
}

function columnIndexForHole(columns: string[], holeNumber: number): number {
  return columns.findIndex(
    (column) => holeNumberFromColumn(column) === holeNumber
  );
}

function valueForHole(
  columns: string[],
  values: (number | null)[],
  holeNumber: number
): number | null {
  const index = columnIndexForHole(columns, holeNumber);
  return index >= 0 ? (values[index] ?? null) : null;
}

function teeToRowKeys(tee: CourseTeeInput): string[] {
  return TEE_ROW_ALIASES[tee.teeKey] ?? [tee.teeName.trim().toUpperCase()];
}

function findRowValues(
  rows: Record<string, (number | null)[] | undefined>,
  aliases: string[]
): (number | null)[] | null {
  for (const alias of aliases) {
    const normalized = alias.toUpperCase().replace(/['']/g, "'");
    if (rows[normalized] != null) return rows[normalized]!;
    if (rows[alias] != null) return rows[alias]!;
  }

  for (const [key, values] of Object.entries(rows)) {
    const normalizedKey = key.toUpperCase().replace(/['']/g, "'");
    if (
      aliases.some(
        (alias) => normalizedKey === alias.toUpperCase().replace(/['']/g, "'")
      )
    ) {
      return values ?? null;
    }
  }

  return null;
}

function buildSpreadsheetPrompt(
  holeCount: number,
  requestedTees: CourseTeeInput[]
): string {
  const teeRows = requestedTees.map((tee) => teeToRowKeys(tee)[0]).join(", ");
  const teeRowKeys = requestedTees
    .map((tee) => `"${teeToRowKeys(tee)[0]}": [/* 21 values, same order as columns */]`)
    .join(",\n    ");

  const columnExample =
    holeCount === 18
      ? CANONICAL_18_COLUMNS.map((column) => `"${column}"`).join(",")
      : Array.from({ length: holeCount }, (_, index) => `"${index + 1}"`).join(
          ","
        );

  return `Extract tee yardages and PAR from this scorecard grid.
Do NOT extract handicap rows — those are extracted separately.

Requested tee rows: ${teeRows}

Use this exact columns array (21 columns for 18-hole cards):
[${columnExample}]

Return JSON:
{
  "columns": [${columnExample}],
  "rows": {
    ${teeRowKeys},
    "PAR": []
  },
  "warnings": []
}

Read each row left-to-right, one value per column, same length as columns.`;
}

function buildMensHandicapRowPrompt(
  holeCount: number,
  rowLabel: string
): string {
  const columnExample =
    holeCount === 18
      ? CANONICAL_18_COLUMNS.map((column) => `"${column}"`).join(", ")
      : Array.from({ length: holeCount }, (_, index) => `"${index + 1}"`).join(
          ", "
        );

  const exampleValues =
    holeCount === 18
      ? "[8,6,10,14,4,18,16,12,2,null,1,3,7,17,13,11,5,15,9,null,null]"
      : "[/* one value per hole column */]";

  return `Read ONLY the ${rowLabel} row from this scorecard.

Columns (fixed order, same as tee rows): ${columnExample}

Return JSON with exactly ${holeCount === 18 ? 21 : holeCount} values — one per column:
{
  "values": ${exampleValues}
}

Rules:
- Read like the BLUE tee row: left-to-right, one cell per column header
- Hole 11 = value under column "11" (index 11 in the array above)
- Hole 12 = value under column "12" (index 12)
- OUT (index 9), IN (index 19), TOT (index 20) = null for handicap rows
- Never compress to 18 values — keep all ${holeCount === 18 ? 21 : holeCount} slots`;
}

function formatHandicapRowForPrompt(
  columns: string[],
  values: (number | null)[]
): string {
  return `[${columns
    .map((_, index) => {
      const value = values[index];
      return value == null ? "null" : String(value);
    })
    .join(",")}]`;
}

function buildLadiesHandicapRowPrompt(
  holeCount: number,
  columns: string[],
  mensHandicap: (number | null)[],
  rowLabel: string,
  mensRowLabel: string
): string {
  const columnExample =
    holeCount === 18
      ? CANONICAL_18_COLUMNS.map((column) => `"${column}"`).join(", ")
      : Array.from({ length: holeCount }, (_, index) => `"${index + 1}"`).join(
          ", "
        );

  const ladiesExample =
    holeCount === 18
      ? "[5,1,13,9,3,17,15,11,7,null,6,4,2,18,14,12,8,16,10,null,null]"
      : "[/* one value per hole column */]";

  const mensRowForReference =
    holeCount === 18 && mensHandicap.some((value) => value != null)
      ? formatHandicapRowForPrompt(columns, mensHandicap)
      : null;

  return `Read ONLY the ${rowLabel} row from this scorecard.

The ${rowLabel} row is directly BELOW the ${mensRowLabel} row when both are present. It has different numbers.
${
  mensRowForReference
    ? `
${mensRowLabel} row (already read — DO NOT copy these values):
${mensRowForReference}
`
    : ""
}
Columns (fixed order, same as tee rows): ${columnExample}

Return JSON with exactly ${holeCount === 18 ? 21 : holeCount} values from the LADIES row only:
{
  "values": ${ladiesExample}
}

Rules:
- Read the ${rowLabel} row — NOT the ${mensRowLabel} row above it
- Read left-to-right, one cell per column header, same as tee yardages
- Hole 11 = ladies value under column "11" (index 11)
- Hole 12 = ladies value under column "12" (index 12)
- OUT (index 9), IN (index 19), TOT (index 20) = null
- Never compress to 18 values — keep all ${holeCount === 18 ? 21 : holeCount} slots
- If your values match the ${mensRowLabel} row above, you read the wrong row — read again from ${rowLabel}`;
}

function buildLadiesHandicapByHolePrompt(
  holeCount: number,
  rowLabel: string,
  mensRowLabel: string
): string {
  return `Read ONLY the ${rowLabel} row from this scorecard.

For each hole column 1 through ${holeCount}, return the ladies stroke index printed in that column on the ${rowLabel} row — NOT the ${mensRowLabel} row.

Return JSON keyed by hole number:
{
  "ladiesHandicapByHole": {
    "1": /* ${rowLabel} column "1" */,
    "2": /* column "2" */,
    ...
    "11": /* column "11" */,
    "12": /* column "12" */,
    ...
    "${holeCount}": /* column "${holeCount}" */
  }
}

Do not read from ${mensRowLabel}. Include all holes 1–${holeCount}.`;
}

async function callVisionOcr(
  apiKey: string,
  imageUrl: string,
  prompt: string,
  systemPrompt: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      temperature: 0,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageUrl, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Scorecard extraction failed (${response.status}): ${errorBody.slice(0, 200)}`
    );
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Scorecard extraction returned an empty response.");
  }

  return content;
}

function parseSpreadsheetPayload(raw: string): SpreadsheetGrid {
  try {
    return JSON.parse(raw) as SpreadsheetGrid;
  } catch {
    throw new Error("Could not parse scorecard grid response.");
  }
}

function parseHandicapRowPayload(raw: string): HandicapRowPayload {
  try {
    return JSON.parse(raw) as HandicapRowPayload;
  } catch {
    throw new Error("Could not parse handicap row response.");
  }
}

function normalizeGrid(grid: SpreadsheetGrid): {
  columns: string[];
  rows: Record<string, (number | null)[]>;
} {
  const columns = (grid.columns ?? []).map((column) =>
    normalizeColumnLabel(String(column))
  );

  const rows: Record<string, (number | null)[]> = {};
  for (const [key, values] of Object.entries(grid.rows ?? {})) {
    const normalizedKey = key.toUpperCase().replace(/['']/g, "'");
    rows[normalizedKey] = (values ?? []).map((value) =>
      value == null || !Number.isFinite(value) ? null : Math.round(value)
    );
  }

  return { columns, rows };
}

function holeColumnIndexes(columns: string[]): number[] {
  return columns
    .map((column, index) => ({ column, index }))
    .filter((entry) => isHoleColumn(entry.column))
    .map((entry) => entry.index);
}

function realignRowToColumns(
  ocrColumns: string[],
  values: (number | null)[],
  targetColumns: string[]
): (number | null)[] {
  if (ocrColumns.length === 0) {
    return values.length === targetColumns.length
      ? values
      : targetColumns.map(() => null);
  }

  return targetColumns.map((targetLabel) => {
    const ocrIndex = ocrColumns.findIndex(
      (column) =>
        normalizeColumnLabel(column) === normalizeColumnLabel(targetLabel)
    );
    if (ocrIndex < 0 || ocrIndex >= values.length) return null;
    return values[ocrIndex] ?? null;
  });
}

function expandCompressedHandicapRow(
  values: (number | null)[],
  columns: string[]
): (number | null)[] {
  const holeIndexes = holeColumnIndexes(columns);
  if (values.length !== holeIndexes.length) return values;

  const expanded: (number | null)[] = columns.map(() => null);
  for (let index = 0; index < holeIndexes.length; index += 1) {
    expanded[holeIndexes[index]!] = values[index] ?? null;
  }
  return expanded;
}

function repairHandicapOutShift(
  values: (number | null)[],
  columns: string[],
  holeCount: number
): (number | null)[] {
  if (values.length !== columns.length) return values;

  const outIndex = columns.findIndex(
    (column) => normalizeColumnLabel(column) === "OUT"
  );
  if (outIndex < 0) return values;

  const outValue = values[outIndex];
  if (outValue == null || outValue < 1 || outValue > holeCount) return values;

  const inIndex = columns.findIndex(
    (column) => normalizeColumnLabel(column) === "IN"
  );
  const totIndex = columns.findIndex(
    (column) => normalizeColumnLabel(column) === "TOT"
  );
  const inValue = inIndex >= 0 ? values[inIndex] : null;
  const totValue = totIndex >= 0 ? values[totIndex] : null;
  const summaryHasHandicap =
    (inValue != null && inValue >= 1 && inValue <= holeCount) ||
    (totValue != null && totValue >= 1 && totValue <= holeCount);
  if (summaryHasHandicap) return values;

  const front = values.slice(0, outIndex);
  const backChunk = values.slice(outIndex, outIndex + 9);
  const repaired = [...front, null, ...backChunk, null, null];
  return repaired.length === columns.length ? repaired : values;
}

function normalizeHandicapRow(
  values: (number | null)[],
  columns: string[],
  holeCount: number
): (number | null)[] {
  let normalized =
    values.length === columns.length
      ? values
      : expandCompressedHandicapRow(values, columns);

  if (normalized.length !== columns.length) {
    normalized = columns.map(() => null);
  }

  normalized = repairHandicapOutShift(normalized, columns, holeCount);

  for (let index = 0; index < normalized.length; index += 1) {
    const value = normalized[index];
    if (value == null) continue;
    if (!isHoleColumn(columns[index]!)) {
      normalized[index] = null;
      continue;
    }
    if (value < 1 || value > holeCount) {
      normalized[index] = null;
    }
  }

  return normalized;
}

async function extractMensHandicapRow(
  apiKey: string,
  imageUrl: string,
  holeCount: number,
  columns: string[],
  row: ScorecardHandicapRowInput
): Promise<(number | null)[]> {
  const rowLabel = ocrRowLabelForHandicapRow(row);
  const content = await callVisionOcr(
    apiKey,
    imageUrl,
    buildMensHandicapRowPrompt(holeCount, rowLabel),
    MENS_HANDICAP_ROW_SYSTEM_PROMPT
  );
  const payload = parseHandicapRowPayload(content);
  const values = (payload.values ?? []).map((value) =>
    value == null || !Number.isFinite(value) ? null : Math.round(value)
  );
  return normalizeHandicapRow(values, columns, holeCount);
}

async function extractLadiesHandicapRow(
  apiKey: string,
  imageUrl: string,
  holeCount: number,
  columns: string[],
  mensHandicap: (number | null)[],
  ladiesRow: ScorecardHandicapRowInput,
  mensRow: ScorecardHandicapRowInput | null
): Promise<(number | null)[]> {
  const ladiesLabel = ocrRowLabelForHandicapRow(ladiesRow);
  const mensLabel = mensRow ? ocrRowLabelForHandicapRow(mensRow) : "MEN'S HDCP";
  const content = await callVisionOcr(
    apiKey,
    imageUrl,
    buildLadiesHandicapRowPrompt(
      holeCount,
      columns,
      mensHandicap,
      ladiesLabel,
      mensLabel
    ),
    LADIES_HANDICAP_ROW_SYSTEM_PROMPT
  );
  const payload = parseHandicapRowPayload(content);
  const values = (payload.values ?? []).map((value) =>
    value == null || !Number.isFinite(value) ? null : Math.round(value)
  );
  return normalizeHandicapRow(values, columns, holeCount);
}

function ladiesHandicapValuesFromPayload(
  payload: LadiesHandicapByHolePayload,
  holeCount: number
): (number | null)[] {
  const byHole = payload.ladiesHandicapByHole ?? {};
  return Array.from({ length: holeCount }, (_, index) => {
    const raw = byHole[String(index + 1)];
    return raw == null || !Number.isFinite(raw) ? null : Math.round(raw);
  });
}

async function extractLadiesHandicapByHole(
  apiKey: string,
  imageUrl: string,
  holeCount: number,
  ladiesRow: ScorecardHandicapRowInput,
  mensRow: ScorecardHandicapRowInput | null
): Promise<(number | null)[] | null> {
  try {
    const ladiesLabel = ocrRowLabelForHandicapRow(ladiesRow);
    const mensLabel = mensRow ? ocrRowLabelForHandicapRow(mensRow) : "MEN'S HDCP";
    const content = await callVisionOcr(
      apiKey,
      imageUrl,
      buildLadiesHandicapByHolePrompt(holeCount, ladiesLabel, mensLabel),
      LADIES_HANDICAP_ROW_SYSTEM_PROMPT
    );
    const payload = JSON.parse(content) as LadiesHandicapByHolePayload;
    const values = ladiesHandicapValuesFromPayload(payload, holeCount);
    return isValidHandicapPermutationByHole(values, holeCount) ? values : null;
  } catch {
    return null;
  }
}

function handicapValuesByHole(
  columns: string[],
  values: (number | null)[],
  holeCount: number
): (number | null)[] {
  return Array.from({ length: holeCount }, (_, index) =>
    valueForHole(columns, values, index + 1)
  );
}

function isValidHandicapPermutationByHole(
  values: (number | null)[],
  holeCount: number
): boolean {
  const seen = new Set<number>();
  for (const value of values) {
    if (value == null) return false;
    if (value < 1 || value > holeCount || seen.has(value)) return false;
    seen.add(value);
  }
  return seen.size === holeCount;
}

function countMatchingHoles(
  left: (number | null)[],
  right: (number | null)[]
): number {
  let matches = 0;
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] != null && left[index] === right[index]) {
      matches += 1;
    }
  }
  return matches;
}

function resolveLadiesHandicap(
  columns: string[],
  rowPass: (number | null)[],
  holeKeyedPass: (number | null)[] | null,
  mensHandicap: (number | null)[],
  holeCount: number,
  hasMensReference: boolean
): (number | null)[] {
  const rowByHole = handicapValuesByHole(columns, rowPass, holeCount);
  const mensByHole = handicapValuesByHole(columns, mensHandicap, holeCount);
  const rowValid = isValidHandicapPermutationByHole(rowByHole, holeCount);
  const rowMatchesMens = hasMensReference
    ? countMatchingHoles(rowByHole, mensByHole)
    : 0;

  if (holeKeyedPass != null) {
    const keyedMatchesMens = hasMensReference
      ? countMatchingHoles(holeKeyedPass, mensByHole)
      : 0;
    const keyedValid = isValidHandicapPermutationByHole(holeKeyedPass, holeCount);

    if (keyedValid) {
      if (!rowValid || (hasMensReference && rowMatchesMens >= 14)) {
        return expandKeyedHandicapToColumns(holeKeyedPass, columns);
      }
      if (countMatchingHoles(rowByHole, holeKeyedPass) >= 16) {
        return rowPass;
      }
      if (hasMensReference && keyedMatchesMens < rowMatchesMens) {
        return expandKeyedHandicapToColumns(holeKeyedPass, columns);
      }
    }
  }

  if (rowValid && (!hasMensReference || rowMatchesMens < 14)) {
    return rowPass;
  }

  if (holeKeyedPass != null && isValidHandicapPermutationByHole(holeKeyedPass, holeCount)) {
    return expandKeyedHandicapToColumns(holeKeyedPass, columns);
  }

  return rowPass;
}

function expandKeyedHandicapToColumns(
  byHole: (number | null)[],
  columns: string[]
): (number | null)[] {
  return columns.map((column) => {
    const hole = holeNumberFromColumn(column);
    if (hole == null) return null;
    return byHole[hole - 1] ?? null;
  });
}

function alignRowToColumns(
  columns: string[],
  values: (number | null)[],
  warnings: string[],
  rowLabel: string
): (number | null)[] {
  if (values.length === columns.length) return values;

  warnings.push(
    `${rowLabel} row length (${values.length}) doesn't match columns (${columns.length}) — row left blank.`
  );
  return columns.map(() => null);
}

function valueAtColumn(
  columns: string[],
  values: (number | null)[],
  columnLabel: string
): number | null {
  const index = columns.findIndex(
    (column) => normalizeColumnLabel(column) === normalizeColumnLabel(columnLabel)
  );
  if (index < 0) return null;
  return values[index] ?? null;
}

function clearColumns(
  values: (number | null)[],
  indexes: number[]
): (number | null)[] {
  const next = [...values];
  for (const index of indexes) {
    next[index] = null;
  }
  return next;
}

function nineHoleIndexes(
  columns: string[],
  nine: "front" | "back"
): number[] {
  return columns
    .map((column, index) => ({ column, index }))
    .filter((entry) => {
      if (!isHoleColumn(entry.column)) return false;
      const hole = holeNumberFromColumn(entry.column)!;
      return nine === "front" ? hole >= 1 && hole <= 9 : hole >= 10 && hole <= 18;
    })
    .map((entry) => entry.index);
}

function sumAtIndexes(
  values: (number | null)[],
  indexes: number[]
): number {
  return indexes.reduce((sum, index) => sum + (values[index] ?? 0), 0);
}

function hasValuesAtIndexes(
  values: (number | null)[],
  indexes: number[]
): boolean {
  return indexes.some((index) => values[index] != null);
}

function tryUniqueParCorrection(
  values: (number | null)[],
  columns: string[],
  indexes: number[],
  expectedSum: number,
  currentSum: number,
  warnings: string[]
): (number | null)[] | null {
  const diff = currentSum - expectedSum;
  if (Math.abs(diff) !== 1) return null;

  const candidates = indexes.filter((index) => {
    const current = values[index];
    if (current == null) return false;
    const corrected = current - diff;
    return corrected >= 3 && corrected <= 5;
  });

  if (candidates.length !== 1) return null;

  const index = candidates[0]!;
  const current = values[index]!;
  const corrected = current - diff;
  const next = [...values];
  next[index] = corrected;
  warnings.push(
    `Hole ${columns[index]} par corrected from ${current} to ${corrected} to match scorecard total (${expectedSum}).`
  );
  return next;
}

function sanitizeTeeRow(
  columns: string[],
  values: (number | null)[],
  teeName: string,
  warnings: string[]
): (number | null)[] {
  let sanitized = alignRowToColumns(columns, values, warnings, teeName);

  const holeIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter((entry) => isHoleColumn(entry.column));

  for (const { column, index } of holeIndexes) {
    const value = sanitized[index];
    if (value == null) continue;
    if (value < MIN_YARDAGE || value > MAX_YARDAGE) {
      sanitized[index] = null;
      warnings.push(
        `Hole ${column} ${teeName} yardage (${value}) out of range — left blank.`
      );
    }
  }

  const frontIndexes = holeIndexes
    .filter((entry) => {
      const hole = holeNumberFromColumn(entry.column);
      return hole != null && hole >= 1 && hole <= 9;
    })
    .map((entry) => entry.index);

  const backIndexes = holeIndexes
    .filter((entry) => {
      const hole = holeNumberFromColumn(entry.column);
      return hole != null && hole >= 10 && hole <= 18;
    })
    .map((entry) => entry.index);

  const outTotal = valueAtColumn(columns, sanitized, "OUT");
  if (frontIndexes.length > 0 && outTotal != null) {
    const frontSum = frontIndexes.reduce(
      (sum, index) => sum + (sanitized[index] ?? 0),
      0
    );
    const hasFrontValues = frontIndexes.some((index) => sanitized[index] != null);
    if (hasFrontValues && Math.abs(frontSum - outTotal) > TOTAL_TOLERANCE) {
      warnings.push(
        `${teeName} front nine sum (${frontSum}) doesn't match OUT (${outTotal}) — front nine left blank.`
      );
      sanitized = clearColumns(sanitized, frontIndexes);
    }
  }

  const inTotal = valueAtColumn(columns, sanitized, "IN");
  if (backIndexes.length > 0 && inTotal != null) {
    const backSum = backIndexes.reduce(
      (sum, index) => sum + (sanitized[index] ?? 0),
      0
    );
    const hasBackValues = backIndexes.some((index) => sanitized[index] != null);
    if (hasBackValues && Math.abs(backSum - inTotal) > TOTAL_TOLERANCE) {
      warnings.push(
        `${teeName} back nine sum (${backSum}) doesn't match IN (${inTotal}) — back nine left blank.`
      );
      sanitized = clearColumns(sanitized, backIndexes);
    }
  }

  return sanitized;
}

function reconcileParSection(
  values: (number | null)[],
  columns: string[],
  indexes: number[],
  expectedTotal: number | null,
  totalLabel: "OUT" | "IN" | "TOT",
  sectionLabel: string,
  warnings: string[]
): (number | null)[] {
  if (indexes.length === 0 || expectedTotal == null) return values;
  if (!hasValuesAtIndexes(values, indexes)) return values;

  let current = values;
  let sum = sumAtIndexes(current, indexes);

  if (sum === expectedTotal) return current;

  const corrected = tryUniqueParCorrection(
    current,
    columns,
    indexes,
    expectedTotal,
    sum,
    warnings
  );
  if (corrected != null) {
    current = corrected;
    sum = sumAtIndexes(current, indexes);
    if (sum === expectedTotal) return current;
  }

  const suspectHoles = indexes
    .filter((index) => current[index] != null)
    .map((index) => columns[index])
    .join(", ");

  warnings.push(
    `PAR ${sectionLabel}: holes sum to ${sum}, scorecard ${totalLabel} shows ${expectedTotal} — check holes ${suspectHoles}.`
  );

  return current;
}

function totalsMatch(
  sum: number | null,
  expected: number | null,
  tolerance: number
): boolean {
  return (
    sum != null &&
    expected != null &&
    Math.abs(sum - expected) <= tolerance
  );
}

function buildSectionTotalsValidation(
  columns: string[],
  values: (number | null)[],
  tolerance: number
): ScorecardSectionTotalsValidation {
  const frontIndexes = nineHoleIndexes(columns, "front");
  const backIndexes = nineHoleIndexes(columns, "back");
  const allHoleIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter((entry) => isHoleColumn(entry.column))
    .map((entry) => entry.index);

  const frontExpected = valueAtColumn(columns, values, "OUT");
  const backExpected = valueAtColumn(columns, values, "IN");
  const totalExpected =
    valueAtColumn(columns, values, "TOT") ??
    valueAtColumn(columns, values, "TOTAL");

  const frontSum = hasValuesAtIndexes(values, frontIndexes)
    ? sumAtIndexes(values, frontIndexes)
    : null;
  const backSum = hasValuesAtIndexes(values, backIndexes)
    ? sumAtIndexes(values, backIndexes)
    : null;
  const totalSum = hasValuesAtIndexes(values, allHoleIndexes)
    ? sumAtIndexes(values, allHoleIndexes)
    : null;

  return {
    frontSum,
    frontExpected,
    frontMatches: totalsMatch(frontSum, frontExpected, tolerance),
    backSum,
    backExpected,
    backMatches: totalsMatch(backSum, backExpected, tolerance),
    totalSum,
    totalExpected,
    totalMatches: totalsMatch(totalSum, totalExpected, tolerance),
  };
}

function buildParValidation(
  columns: string[],
  parValues: (number | null)[]
): ScorecardParValidation {
  return buildSectionTotalsValidation(columns, parValues, 0);
}

function isValidHandicapPermutation(
  columns: string[],
  values: (number | null)[],
  holeCount: number
): boolean {
  const seen = new Set<number>();
  for (let hole = 1; hole <= holeCount; hole += 1) {
    const value = valueForHole(columns, values, hole);
    if (value == null) return false;
    if (value < 1 || value > holeCount || seen.has(value)) return false;
    seen.add(value);
  }
  return seen.size === holeCount;
}

function buildHandicapValidation(
  label: string,
  columns: string[],
  values: (number | null)[],
  holeCount: number
): ScorecardStrokeIndexValidation {
  const holeValues = Array.from({ length: holeCount }, (_, index) =>
    valueForHole(columns, values, index + 1)
  );
  const numbers = holeValues.filter((value): value is number => value != null);
  const sum = numbers.length > 0 ? numbers.reduce((total, value) => total + value, 0) : null;

  return {
    label,
    sum,
    expectedSum: expectedStrokeIndexSum(holeCount),
    isValidPermutation: isValidHandicapPermutation(columns, values, holeCount),
  };
}

function sanitizeParRow(
  columns: string[],
  values: (number | null)[],
  warnings: string[]
): (number | null)[] {
  let sanitized = alignRowToColumns(columns, values, warnings, "PAR");

  for (let index = 0; index < sanitized.length; index += 1) {
    const value = sanitized[index];
    if (value == null) continue;
    if (!isHoleColumn(columns[index]!)) continue;
    if (value < 3 || value > 5) {
      sanitized[index] = null;
      warnings.push(
        `Hole ${columns[index]} par (${value}) invalid — left blank.`
      );
    }
  }

  const frontIndexes = nineHoleIndexes(columns, "front");
  const backIndexes = nineHoleIndexes(columns, "back");
  const allHoleIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter((entry) => isHoleColumn(entry.column))
    .map((entry) => entry.index);

  sanitized = reconcileParSection(
    sanitized,
    columns,
    frontIndexes,
    valueAtColumn(columns, sanitized, "OUT"),
    "OUT",
    "front nine",
    warnings
  );

  sanitized = reconcileParSection(
    sanitized,
    columns,
    backIndexes,
    valueAtColumn(columns, sanitized, "IN"),
    "IN",
    "back nine",
    warnings
  );

  const totalExpected =
    valueAtColumn(columns, sanitized, "TOT") ??
    valueAtColumn(columns, sanitized, "TOTAL");

  if (totalExpected != null && allHoleIndexes.length > 0) {
    sanitized = reconcileParSection(
      sanitized,
      columns,
      allHoleIndexes,
      totalExpected,
      "TOT",
      "course total",
      warnings
    );
  }

  return sanitized;
}

function blankImplausibleTeeOrder(
  holes: ScorecardOcrHole[],
  tees: CourseTeeInput[]
) {
  const teeKeys = tees.map((tee) => tee.teeKey);

  for (const hole of holes) {
    const blue = teeKeys.includes("blue") ? Number(hole.teeYardages.blue) : NaN;
    const white = teeKeys.includes("white")
      ? Number(hole.teeYardages.white)
      : NaN;
    const red = teeKeys.includes("red") ? Number(hole.teeYardages.red) : NaN;

    if (Number.isFinite(blue) && Number.isFinite(red) && blue < red) {
      hole.teeYardages.blue = "";
    }
    if (Number.isFinite(blue) && Number.isFinite(white) && blue < white) {
      hole.teeYardages.blue = "";
    }
    if (Number.isFinite(white) && Number.isFinite(red) && white < red) {
      hole.teeYardages.white = "";
    }
  }
}

function formatStrokeIndex(
  value: number | null,
  holeCount: number
): string {
  return value != null && value >= 1 && value <= holeCount ? String(value) : "";
}

function buildHolesFromGrid(
  holeCount: number,
  tees: CourseTeeInput[],
  columns: string[],
  rows: Record<string, (number | null)[]>,
  mensHandicap: (number | null)[],
  ladiesHandicap: (number | null)[],
  warnings: string[],
  extractMens: boolean,
  extractLadies: boolean
): {
  holes: ScorecardOcrHole[];
  parValidation: ScorecardParValidation | null;
  yardageValidation: ScorecardYardageValidation[];
  handicapValidation: ScorecardStrokeIndexValidation[];
} {
  const parValues = sanitizeParRow(
    columns,
    findRowValues(rows, ["PAR"]) ?? [],
    warnings
  );
  const parValidation =
    columns.length > 0 ? buildParValidation(columns, parValues) : null;

  const teeValuesByKey = new Map<string, (number | null)[]>();
  const yardageValidation: ScorecardYardageValidation[] = [];
  for (const tee of tees) {
    const raw = findRowValues(rows, teeToRowKeys(tee)) ?? [];
    const sanitized = sanitizeTeeRow(columns, raw, tee.teeName, warnings);
    teeValuesByKey.set(tee.teeKey, sanitized);
    yardageValidation.push({
      teeKey: tee.teeKey,
      teeName: tee.teeName,
      totals: buildSectionTotalsValidation(columns, sanitized, TOTAL_TOLERANCE),
    });
  }

  const holes: ScorecardOcrHole[] = [];

  for (let holeNumber = 1; holeNumber <= holeCount; holeNumber += 1) {
    const columnIndex = columnIndexForHole(columns, holeNumber);
    const teeYardages: Record<string, string> = {};

    if (columnIndex < 0) {
      warnings.push(`Hole ${holeNumber} column not found in grid — left blank.`);
    }

    const par =
      columnIndex >= 0 ? (parValues[columnIndex] ?? null) : null;
    const mensValue = valueForHole(columns, mensHandicap, holeNumber);
    const ladiesValue = valueForHole(columns, ladiesHandicap, holeNumber);

    if (par == null) {
      warnings.push(`Hole ${holeNumber} par missing — left blank.`);
    }
    if (extractMens && mensValue == null) {
      warnings.push(`Hole ${holeNumber} men's handicap missing — left blank.`);
    }
    if (extractLadies && ladiesValue == null) {
      warnings.push(`Hole ${holeNumber} ladies' handicap missing — left blank.`);
    }

    for (const tee of tees) {
      const rowValues = teeValuesByKey.get(tee.teeKey);
      const yardage =
        columnIndex >= 0 && rowValues ? (rowValues[columnIndex] ?? null) : null;
      teeYardages[tee.teeKey] = yardage == null ? "" : String(yardage);
    }

    holes.push({
      holeNumber,
      par: par != null && par >= 3 && par <= 5 ? par : 4,
      strokeIndex: extractMens ? formatStrokeIndex(mensValue, holeCount) : "",
      ladiesStrokeIndex: extractLadies
        ? formatStrokeIndex(ladiesValue, holeCount)
        : "",
      teeYardages,
    });
  }

  blankImplausibleTeeOrder(holes, tees);

  return {
    holes,
    parValidation,
    yardageValidation,
    handicapValidation: [
      ...(extractMens
        ? [buildHandicapValidation("Men's HCP", columns, mensHandicap, holeCount)]
        : []),
      ...(extractLadies
        ? [
            buildHandicapValidation(
              "Ladies HCP",
              columns,
              ladiesHandicap,
              holeCount
            ),
          ]
        : []),
    ],
  };
}

function emptyHandicapRow(columns: string[]): (number | null)[] {
  return columns.map(() => null);
}

function findHandicapRowConfig(
  rows: ScorecardHandicapRowInput[],
  rowKey: ScorecardHandicapRowKey
): ScorecardHandicapRowInput | null {
  return rows.find((row) => row.rowKey === rowKey) ?? null;
}

export async function extractScorecardFromImage(
  imageUrl: string,
  holeCount: number,
  requestedTees: CourseTeeInput[] = [],
  requestedHandicapRows: ScorecardHandicapRowInput[] = DEFAULT_SCORECARD_HANDICAP_ROWS
): Promise<ScorecardOcrResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Scorecard OCR is not configured. Add OPENAI_API_KEY to your environment."
    );
  }

  if (!isScorecardImageUrl(imageUrl)) {
    throw new Error("Upload a valid scorecard image before extracting data.");
  }

  if (requestedTees.length === 0) {
    throw new Error("Select the tee colors on this scorecard before extracting.");
  }

  const tees = sortCourseTees(requestedTees);
  const handicapRows = sortScorecardHandicapRows(requestedHandicapRows);
  const columns = canonicalScorecardColumns(holeCount);
  const mensRow = findHandicapRowConfig(handicapRows, "mens");
  const ladiesRow = findHandicapRowConfig(handicapRows, "ladies");
  const extractMens = mensRow != null;
  const extractLadies = ladiesRow != null;

  const gridPromise = callVisionOcr(
    apiKey,
    imageUrl,
    buildSpreadsheetPrompt(holeCount, tees),
    GRID_SYSTEM_PROMPT
  );

  const mensHandicap = extractMens
    ? await extractMensHandicapRow(
        apiKey,
        imageUrl,
        holeCount,
        columns,
        mensRow
      )
    : emptyHandicapRow(columns);

  const [gridContent, ladiesHandicap] = await Promise.all([
    gridPromise,
    extractLadies
      ? (async () => {
          const [ladiesRowPass, ladiesHoleKeyedPass] = await Promise.all([
            extractLadiesHandicapRow(
              apiKey,
              imageUrl,
              holeCount,
              columns,
              mensHandicap,
              ladiesRow,
              mensRow
            ),
            extractLadiesHandicapByHole(
              apiKey,
              imageUrl,
              holeCount,
              ladiesRow,
              mensRow
            ),
          ]);
          return resolveLadiesHandicap(
            columns,
            ladiesRowPass,
            ladiesHoleKeyedPass,
            mensHandicap,
            holeCount,
            extractMens
          );
        })()
      : Promise.resolve(emptyHandicapRow(columns)),
  ]);

  const grid = parseSpreadsheetPayload(gridContent);
  const warnings: string[] = [];
  const { columns: ocrColumns, rows: ocrRows } = normalizeGrid(grid);

  const rows: Record<string, (number | null)[]> = {};
  for (const [key, values] of Object.entries(ocrRows)) {
    rows[key] = realignRowToColumns(ocrColumns, values, columns);
  }

  const { holes, parValidation, yardageValidation, handicapValidation } =
    buildHolesFromGrid(
      holeCount,
      tees,
      columns,
      rows,
      mensHandicap,
      ladiesHandicap,
      warnings,
      extractMens,
      extractLadies
    );

  return {
    tees,
    holes,
    parValidation,
    yardageValidation,
    handicapValidation,
  };
}
