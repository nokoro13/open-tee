import {
  normalizeTeeKey,
  sortCourseTees,
  type CourseTeeInput,
} from "@/lib/course-tees";
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
// gpt-5.6-terra: balanced GPT-5.6 tier — multimodal, reads the image at its
// original resolution (auto detail), and supports strict structured outputs.
const OCR_MODEL = process.env.SCORECARD_OCR_MODEL?.trim() || "gpt-5.6-terra";
const OCR_REASONING_EFFORT =
  process.env.SCORECARD_OCR_REASONING_EFFORT?.trim() || "medium";

// GPT-5 family and o-series reasoning models reject `temperature` and take
// `reasoning_effort`; reasoning tokens count against the completion budget.
const REASONING_MODEL_PATTERN = /^(gpt-5|o\d)/i;

function isReasoningModel(model: string): boolean {
  return REASONING_MODEL_PATTERN.test(model);
}

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

const FRONT_NINE_COLUMNS = [
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
] as const;

const BACK_NINE_COLUMNS = [
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

const TEE_SECTION_SYSTEM_PROMPT = `You read one section of a golf scorecard tee yardage row with perfect fidelity.

Many scorecards split into two separate blocks or panels:
- FRONT NINE block: columns 1, 2, 3, 4, 5, 6, 7, 8, 9, OUT (often the upper or left panel)
- BACK NINE block: columns 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT (often the lower or right panel)

Every tee name appears in BOTH blocks — including lower rows like Stewart and Palmer. The front-nine block is easy to miss; read it carefully for every requested tee.

Match the tee row by its printed text label only — never by row ink or background color.

Return exactly one value per column in the requested section, left to right. Use null for blank cells.`;

const GRID_SYSTEM_PROMPT = `You are a meticulous transcriber of golf scorecard images. You convert the printed scorecard grid into structured data with perfect cell-by-cell fidelity.

Scorecard anatomy:
- Hole columns for 18-hole cards are always: 1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT (21 columns). OUT = front-nine total, IN = back-nine total, TOT/TOTAL = 18-hole total.
- Many cards print the front nine and back nine as two stacked blocks, or on facing halves of the card. Each tee row (Championship, Regular, Stewart, Palmer, etc.) appears in BOTH blocks — read holes 1–9 and OUT from the front block, then holes 10–18, IN, and TOT from the back block. Never return back-nine yardages for holes 1–9 or skip the front block for lower tee rows.
- Some cards add extra columns (RATING, SLOPE, HCP, NET, INITIALS, +/-) at the edges or between OUT and 10 — ignore those columns entirely; do not let them shift your alignment.
- Each stat is its own row: one row per tee box, plus PAR and handicap rows.

Tee box rows — match by PRINTED NAME ONLY:
- Identify each tee row by the text label printed on the scorecard (left margin or row header): "Championship", "Regular", "Palmer", "Stewart", "Blue", etc.
- Row ink/background colors are NOT tee names and must NEVER be used to pick a row. Example: "Championship" may be printed in blue, "Regular" in white, "Palmer" in black, "Stewart" in green, and a "Total Yards" summary row in red — those colors do not tell you which tee is which.
- Match each requested tee to the row whose printed label matches (case-insensitive; ignore trailing "TEES"/"TEE"/"YDS"). Partial matches are OK only when unambiguous (e.g. "PALMER TEES" → Palmer).
- Do NOT read summary/stat rows as tee yardages: TOTAL YARDS, YARDAGE, YDS, COMBINED, COMPOSITE, ALL TEES, etc.
- Combination tees like "Blue/White" are their own separate rows — never merge or average rows.
- If a requested name has no matching printed label, return nulls for that row and explain in "warnings".

Transcription rules:
- Every row array MUST have exactly the same length as the columns array — one value per column, index-for-index.
- Read each row strictly left to right. If a cell is blank, unreadable, or obscured, use null. Never guess, interpolate, or shift values to fill gaps.
- Per-hole yardages are 2–4 digit numbers (roughly 70–700). OUT/IN totals are ~4 digits; TOT is ~4–5 digits. Par per hole is 3, 4, or 5 (occasionally 6).

Mandatory self-verification before answering:
1. For every tee row: sum the nine values under columns 1–9 and compare with the value you read under OUT; sum columns 10–18 and compare with IN; OUT + IN must equal TOT. If any check fails, re-read that row cell by cell and correct the misread digits.
2. For the PAR row: the same sums must match OUT/IN/TOT exactly.
3. Confirm every value sits under the correct hole column — cross-check a few cells against the printed hole numbers.
Report any cell you remain unsure about in "warnings" and use null for it.`;

const MENS_HANDICAP_ROW_SYSTEM_PROMPT = `You read the men's stroke-index (handicap) row from a golf scorecard image with perfect fidelity.

The row may be labeled MEN'S HDCP, MEN'S HCP, MEN'S HANDICAP, HANDICAP, HDCP, HCP, STROKE INDEX, S.I., or INDEX. If the card has only one handicap row, that is the men's row. If it has two, the men's row is usually adjacent to the men's tee yardages (above the ladies row).

The column headers are fixed (same as tee yardage rows):
1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT

Read the row exactly like a tee yardage row:
- One cell per column, left to right, 21 values total
- Hole N handicap = cell under column header "N"
- OUT, IN, TOT are blank → use null at those three positions
- Do NOT skip blank OUT/IN/TOT — keep all 21 slots so column "11" stays at index 11
- Handicap values are 1–18 (or 1–9 on nine-hole cards), each used exactly once

Never read handicaps as a compressed list of 18 numbers.

Self-check before answering: the 18 hole values must be exactly the numbers 1 through 18 with no repeats and no gaps. If a number repeats or is missing, re-read the row cell by cell and correct it.`;

const LADIES_HANDICAP_ROW_SYSTEM_PROMPT = `You read the ladies' stroke-index (handicap) row from a golf scorecard image with perfect fidelity.

The row may be labeled LADIES' HDCP, LADIES HCP, LADIES HANDICAP, WOMEN'S HANDICAP, WHC, or LADIES S.I. It is a separate row from the men's handicap row (usually below it, or adjacent to the forward tee yardages). It has DIFFERENT numbers from the men's row.

Column headers (fixed, same as tee rows):
1, 2, 3, 4, 5, 6, 7, 8, 9, OUT, 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT

Read ONLY the ladies' handicap row:
- One cell per column, left to right, 21 values total
- Hole N ladies handicap = cell under column header "N" on the LADIES row
- OUT, IN, TOT are blank on the ladies row → use null at those three positions
- Do NOT read from the men's handicap row — that row has different values
- Do NOT skip blank OUT/IN/TOT — keep all 21 slots

Never read handicaps as a compressed list of 18 numbers.

Self-check before answering: the 18 hole values must be exactly the numbers 1 through 18 with no repeats and no gaps, and they must NOT be identical to the men's row. If a check fails, re-read the ladies row cell by cell.`;

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
  const nameKey = tee.teeName.trim().toUpperCase();
  const keys = [nameKey];
  // Color aliases apply only when the user named the tee with that color word
  // (e.g. teeName "Blue"). Never alias by teeKey alone — preset keys like "blue"
  // must not pull in a differently named row just because it is printed in blue.
  const colorAliases = TEE_ROW_ALIASES[normalizeTeeKey(tee.teeName)] ?? [];
  return [...new Set([...keys, ...colorAliases].filter((key) => key.length > 0))];
}

function normalizeRowKeyForMatch(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/['']/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+(TEES?|COURSE|YARDS?|YDS?)$/g, "")
    .trim();
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

  const normalizedAliases = aliases.map(normalizeRowKeyForMatch);
  for (const [key, values] of Object.entries(rows)) {
    if (values == null) continue;
    const normalizedKey = normalizeRowKeyForMatch(key);
    if (normalizedAliases.includes(normalizedKey)) {
      return values;
    }
  }

  return null;
}

function describeTeeForPrompt(tee: CourseTeeInput): string {
  const rowKey = teeToRowKeys(tee)[0];
  return `- "${rowKey}" — find the row whose printed text label is "${tee.teeName.trim()}" (ignore row color)`;
}

function buildSpreadsheetPrompt(
  holeCount: number,
  requestedTees: CourseTeeInput[]
): string {
  const teeDescriptions = requestedTees.map(describeTeeForPrompt).join("\n");
  const teeRowKeys = requestedTees
    .map(
      (tee) =>
        `"${teeToRowKeys(tee)[0]}": [/* ${
          holeCount === 18 ? 21 : holeCount
        } values, same order as columns */]`
    )
    .join(",\n    ");

  const columnExample =
    holeCount === 18
      ? CANONICAL_18_COLUMNS.map((column) => `"${column}"`).join(",")
      : Array.from({ length: holeCount }, (_, index) => `"${index + 1}"`).join(
          ","
        );

  return `Extract the per-hole yardages for each requested tee box and the PAR row from this scorecard image.
Do NOT extract handicap rows — those are extracted separately.

Requested tee boxes — match each to the row with that exact printed name (NOT row color):
${teeDescriptions}

For each requested tee, locate the scorecard row by its printed text label only. Row background/ink color is irrelevant and misleading. Do not assign a row to a tee because it is blue, white, black, green, or red. Skip summary rows like "Total Yards". Return each row under the exact JSON key shown above. If no row bears that printed name, return nulls and note it in "warnings".

Use this exact columns array (${holeCount === 18 ? "21 columns for 18-hole cards" : `${holeCount} columns`}):
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

Read each row left-to-right, one value per column, same length as columns.
For split front/back layouts: read the front-nine block (holes 1–9 + OUT) and back-nine block (holes 10–18 + IN + TOT) for every tee — including Stewart, Palmer, and other lower rows — then merge into one 21-value row per tee.
Before answering, verify every tee row and the PAR row: holes 1-9 must sum to the OUT cell, holes 10-18 must sum to the IN cell, and OUT + IN must equal TOT. Fix any misread digits before returning.`;
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

type JsonSchemaFormat = {
  name: string;
  strict: true;
  schema: Record<string, unknown>;
};

function nullableIntegerArraySchema(): Record<string, unknown> {
  return {
    type: "array",
    items: { type: ["integer", "null"] },
  };
}

function buildGridResponseSchema(rowKeys: string[]): JsonSchemaFormat {
  const rowProperties: Record<string, unknown> = {};
  for (const rowKey of rowKeys) {
    rowProperties[rowKey] = nullableIntegerArraySchema();
  }

  return {
    name: "scorecard_grid",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        columns: { type: "array", items: { type: "string" } },
        rows: {
          type: "object",
          additionalProperties: false,
          properties: rowProperties,
          required: rowKeys,
        },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["columns", "rows", "warnings"],
    },
  };
}

const HANDICAP_ROW_RESPONSE_SCHEMA: JsonSchemaFormat = {
  name: "scorecard_handicap_row",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      values: nullableIntegerArraySchema(),
    },
    required: ["values"],
  },
};

const TEE_SECTION_RESPONSE_SCHEMA: JsonSchemaFormat = {
  name: "scorecard_tee_section",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      values: nullableIntegerArraySchema(),
    },
    required: ["values"],
  },
};

function buildLadiesByHoleResponseSchema(holeCount: number): JsonSchemaFormat {
  const holeProperties: Record<string, unknown> = {};
  const holeKeys: string[] = [];
  for (let hole = 1; hole <= holeCount; hole += 1) {
    const key = String(hole);
    holeKeys.push(key);
    holeProperties[key] = { type: ["integer", "null"] };
  }

  return {
    name: "scorecard_ladies_handicap_by_hole",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ladiesHandicapByHole: {
          type: "object",
          additionalProperties: false,
          properties: holeProperties,
          required: holeKeys,
        },
      },
      required: ["ladiesHandicapByHole"],
    },
  };
}

async function callVisionOcr(
  apiKey: string,
  imageUrl: string,
  prompt: string,
  systemPrompt: string,
  responseSchema?: JsonSchemaFormat
): Promise<string> {
  const reasoning = isReasoningModel(OCR_MODEL);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OCR_MODEL,
      // Reasoning tokens count against the completion budget on GPT-5 models.
      max_completion_tokens: reasoning ? 16384 : 4096,
      ...(reasoning
        ? { reasoning_effort: OCR_REASONING_EFFORT }
        : { temperature: 0 }),
      response_format: responseSchema
        ? { type: "json_schema", json_schema: responseSchema }
        : { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              // "auto" resolves to original resolution on GPT-5.6 models,
              // which preserves dense scorecard digits; older models get "high".
              image_url: { url: imageUrl, detail: reasoning ? "auto" : "high" },
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

function expandCompressedYardageRow(
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

function sectionFillCount(
  columns: string[],
  values: (number | null)[],
  section: "front" | "back"
): number {
  const sectionColumns =
    section === "front" ? FRONT_NINE_COLUMNS : BACK_NINE_COLUMNS;
  return sectionColumns.filter((label) => {
    const index = columns.findIndex(
      (column) => normalizeColumnLabel(column) === label
    );
    return index >= 0 && values[index] != null;
  }).length;
}

function isFrontNineMissing(
  columns: string[],
  values: (number | null)[]
): boolean {
  if (holeCountFromColumns(columns) !== 18) return false;
  const frontFilled = sectionFillCount(columns, values, "front");
  const backFilled = sectionFillCount(columns, values, "back");
  return frontFilled < 5 && backFilled >= 5;
}

function isBackNineMissing(
  columns: string[],
  values: (number | null)[]
): boolean {
  if (holeCountFromColumns(columns) !== 18) return false;
  const frontFilled = sectionFillCount(columns, values, "front");
  const backFilled = sectionFillCount(columns, values, "back");
  return backFilled < 5 && frontFilled >= 5;
}

function holeCountFromColumns(columns: string[]): number {
  return columns.filter((column) => isHoleColumn(column)).length;
}

function buildTeeSectionPrompt(
  tee: CourseTeeInput,
  section: "front" | "back"
): string {
  const teeName = tee.teeName.trim();
  if (section === "front") {
    return `Read the FRONT NINE yardage block for the tee labeled "${teeName}".

This block has columns: 1, 2, 3, 4, 5, 6, 7, 8, 9, OUT — usually in the upper or left panel of the scorecard.
Find the row whose printed text label is "${teeName}" (ignore row color). Every tee, including lower rows like Stewart and Palmer, has front-nine yardages here.

Return JSON with exactly 10 values — holes 1 through 9, then OUT:
{
  "values": [/* hole 1 */, /* hole 2 */, ..., /* hole 9 */, /* OUT total */]
}`;
  }

  return `Read the BACK NINE yardage block for the tee labeled "${teeName}".

This block has columns: 10, 11, 12, 13, 14, 15, 16, 17, 18, IN, TOT — usually in the lower or right panel of the scorecard.
Find the row whose printed text label is "${teeName}" (ignore row color).

Return JSON with exactly 11 values — holes 10 through 18, then IN, then TOT:
{
  "values": [/* hole 10 */, ..., /* hole 18 */, /* IN total */, /* TOT total */]
}`;
}

function normalizeSectionValues(
  values: (number | null)[],
  expectedLength: number
): (number | null)[] {
  return values.slice(0, expectedLength).map((value) =>
    value == null || !Number.isFinite(value) ? null : Math.round(value)
  );
}

function mergeSectionIntoRow(
  columns: string[],
  existing: (number | null)[],
  sectionValues: (number | null)[],
  section: "front" | "back"
): (number | null)[] {
  const sectionColumns =
    section === "front" ? FRONT_NINE_COLUMNS : BACK_NINE_COLUMNS;
  const merged = [...existing];

  for (let index = 0; index < sectionColumns.length; index += 1) {
    const label = sectionColumns[index]!;
    const value = sectionValues[index] ?? null;
    if (value == null) continue;

    const targetIndex = columns.findIndex(
      (column) => normalizeColumnLabel(column) === label
    );
    if (targetIndex >= 0) {
      merged[targetIndex] = value;
    }
  }

  return merged;
}

async function extractTeeSectionYardages(
  apiKey: string,
  imageUrl: string,
  tee: CourseTeeInput,
  section: "front" | "back"
): Promise<(number | null)[]> {
  const expectedLength = section === "front" ? 10 : 11;
  const content = await callVisionOcr(
    apiKey,
    imageUrl,
    buildTeeSectionPrompt(tee, section),
    TEE_SECTION_SYSTEM_PROMPT,
    TEE_SECTION_RESPONSE_SCHEMA
  );
  const payload = parseHandicapRowPayload(content);
  return normalizeSectionValues(payload.values ?? [], expectedLength);
}

async function fillMissingTeeSections(
  apiKey: string,
  imageUrl: string,
  tees: CourseTeeInput[],
  columns: string[],
  rows: Record<string, (number | null)[]>
): Promise<void> {
  if (holeCountFromColumns(columns) !== 18) return;

  await Promise.all(
    tees.map(async (tee) => {
      const rowKey = teeToRowKeys(tee)[0];
      if (!rowKey) return;

      let row = rows[rowKey];
      if (!row) return;

      row = expandCompressedYardageRow(row, columns);

      if (isFrontNineMissing(columns, row)) {
        const frontValues = await extractTeeSectionYardages(
          apiKey,
          imageUrl,
          tee,
          "front"
        );
        row = mergeSectionIntoRow(columns, row, frontValues, "front");
      }

      if (isBackNineMissing(columns, row)) {
        const backValues = await extractTeeSectionYardages(
          apiKey,
          imageUrl,
          tee,
          "back"
        );
        row = mergeSectionIntoRow(columns, row, backValues, "back");
      }

      rows[rowKey] = row;
    })
  );
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
    MENS_HANDICAP_ROW_SYSTEM_PROMPT,
    HANDICAP_ROW_RESPONSE_SCHEMA
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
    LADIES_HANDICAP_ROW_SYSTEM_PROMPT,
    HANDICAP_ROW_RESPONSE_SCHEMA
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
      LADIES_HANDICAP_ROW_SYSTEM_PROMPT,
      buildLadiesByHoleResponseSchema(holeCount)
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
        `${teeName} front nine sum (${frontSum}) doesn't match OUT (${outTotal}) — verify front-nine yardages.`
      );
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
        `${teeName} back nine sum (${backSum}) doesn't match IN (${inTotal}) — verify back-nine yardages.`
      );
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

  const gridRowKeys = [
    ...new Set([...tees.map((tee) => teeToRowKeys(tee)[0]!), "PAR"]),
  ];
  const gridPromise = callVisionOcr(
    apiKey,
    imageUrl,
    buildSpreadsheetPrompt(holeCount, tees),
    GRID_SYSTEM_PROMPT,
    buildGridResponseSchema(gridRowKeys)
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
    rows[key] = expandCompressedYardageRow(
      realignRowToColumns(ocrColumns, values, columns),
      columns
    );
  }

  await fillMissingTeeSections(apiKey, imageUrl, tees, columns, rows);

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
