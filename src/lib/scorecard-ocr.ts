import {
  normalizeTeeKey,
  sortCourseTees,
  type CourseTeeInput,
} from "@/lib/course-tees";
import { isScorecardImageUrl } from "@/lib/scorecard-image-url";

export type ScorecardOcrHole = {
  holeNumber: number;
  par: number;
  strokeIndex: string;
  teeYardages: Record<string, string>;
};

export type ScorecardOcrResult = {
  tees: CourseTeeInput[];
  holes: ScorecardOcrHole[];
  warnings: string[];
};

type SpreadsheetGrid = {
  columns?: string[];
  rows?: Record<string, (number | null)[] | undefined>;
  warnings?: string[];
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

const HCP_ROW_ALIASES = [
  "MEN_HCP",
  "MENS_HCP",
  "MEN'S HCP",
  "MEN'S HDCP",
  "HCP",
  "HDCP",
];

const SYSTEM_PROMPT = `You read golf scorecards exactly like a spreadsheet.

GRID LAYOUT (battleship):
- Column headers come from the HOLE row: 1, 2, 3 ... 9, OUT, 10 ... 18, IN, TOT
- Each stat is a separate ROW: BLUE, WHITE, RED, PAR, MEN'S HCP
- Cell value = row ∩ column intersection
- Skip the rating/slope label column (e.g. "M - 70.1/126") — do not include it in columns

ACCURACY RULES (most important):
- If you are not certain about a cell, use null. A blank cell is correct; a wrong number is unacceptable.
- NEVER shift values left/right when one cell is missing.
- NEVER copy a value from a different row (Blue row values only in BLUE, Red only in RED).
- Every values array MUST align 1:1 with the columns array (same length, same order).
- OUT / IN / TOT columns contain totals — include them in columns and rows for validation.`;

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
    .map((tee) => `"${teeToRowKeys(tee)[0]}": [/* same length as columns */]`)
    .join(",\n    ");

  const columnExample =
    holeCount === 18
      ? '"1","2","3","4","5","6","7","8","9","OUT","10","11","12","13","14","15","16","17","18","IN","TOT"'
      : Array.from({ length: holeCount }, (_, index) => `"${index + 1}"`).join(
          ","
        );

  return `Extract this scorecard as a spreadsheet grid.

Requested tee rows: ${teeRows}
Also extract: PAR, and men's handicap row (MEN_HCP).

Return JSON:
{
  "columns": [${columnExample}],
  "rows": {
    ${teeRowKeys},
    "PAR": [],
    "MEN_HCP": []
  },
  "warnings": []
}

Process:
1. Read the HOLE row left-to-right to build the "columns" array (skip rating/slope column).
2. For each row (BLUE, WHITE, RED, PAR, MEN_HCP), read values left-to-right in the SAME column order.
3. Each row array length MUST equal columns.length.
4. Use null for unreadable/uncertain cells — never guess.
5. Include OUT, IN, TOT in columns with their total values in each row.`;
}

async function callVisionOcr(
  apiKey: string,
  imageUrl: string,
  prompt: string
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
        { role: "system", content: SYSTEM_PROMPT },
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

  const outPar = valueAtColumn(columns, sanitized, "OUT");
  const frontIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(
      (entry) =>
        isHoleColumn(entry.column) &&
        holeNumberFromColumn(entry.column)! >= 1 &&
        holeNumberFromColumn(entry.column)! <= 9
    )
    .map((entry) => entry.index);

  if (outPar != null && frontIndexes.length > 0) {
    const frontParSum = frontIndexes.reduce(
      (sum, index) => sum + (sanitized[index] ?? 0),
      0
    );
    const hasValues = frontIndexes.some((index) => sanitized[index] != null);
    if (hasValues && Math.abs(frontParSum - outPar) > 1) {
      warnings.push(
        `PAR front nine sum (${frontParSum}) doesn't match OUT (${outPar}) — front nine par left blank.`
      );
      sanitized = clearColumns(sanitized, frontIndexes);
    }
  }

  return sanitized;
}

function sanitizeHcpRow(
  columns: string[],
  values: (number | null)[],
  warnings: string[]
): (number | null)[] {
  const sanitized = alignRowToColumns(columns, values, warnings, "HCP");

  for (let index = 0; index < sanitized.length; index += 1) {
    const value = sanitized[index];
    if (value == null) continue;
    if (!isHoleColumn(columns[index]!)) continue;
    if (value < 1 || value > 18) {
      sanitized[index] = null;
      warnings.push(
        `Hole ${columns[index]} handicap (${value}) invalid — left blank.`
      );
    }
  }

  return sanitized;
}

function blankImplausibleTeeOrder(
  holes: ScorecardOcrHole[],
  tees: CourseTeeInput[],
  warnings: string[]
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
      warnings.push(
        `Hole ${hole.holeNumber}: Blue (${blue}) < Red (${red}) — Blue left blank.`
      );
    }

    if (Number.isFinite(blue) && Number.isFinite(white) && blue < white) {
      hole.teeYardages.blue = "";
      warnings.push(
        `Hole ${hole.holeNumber}: Blue (${blue}) < White (${white}) — Blue left blank.`
      );
    }

    if (Number.isFinite(white) && Number.isFinite(red) && white < red) {
      hole.teeYardages.white = "";
      warnings.push(
        `Hole ${hole.holeNumber}: White (${white}) < Red (${red}) — White left blank.`
      );
    }
  }
}

function buildHolesFromGrid(
  holeCount: number,
  tees: CourseTeeInput[],
  columns: string[],
  rows: Record<string, (number | null)[]>,
  warnings: string[]
): ScorecardOcrHole[] {
  const parValues = sanitizeParRow(
    columns,
    findRowValues(rows, ["PAR"]) ?? [],
    warnings
  );
  const hcpValues = sanitizeHcpRow(
    columns,
    findRowValues(rows, HCP_ROW_ALIASES) ?? [],
    warnings
  );

  const teeValuesByKey = new Map<string, (number | null)[]>();
  for (const tee of tees) {
    const raw = findRowValues(rows, teeToRowKeys(tee)) ?? [];
    teeValuesByKey.set(
      tee.teeKey,
      sanitizeTeeRow(columns, raw, tee.teeName, warnings)
    );
  }

  const columnIndexByHole = new Map<number, number>();
  for (let index = 0; index < columns.length; index += 1) {
    const hole = holeNumberFromColumn(columns[index]!);
    if (hole != null) columnIndexByHole.set(hole, index);
  }

  const holes: ScorecardOcrHole[] = [];

  for (let holeNumber = 1; holeNumber <= holeCount; holeNumber += 1) {
    const columnIndex = columnIndexByHole.get(holeNumber);
    const teeYardages: Record<string, string> = {};

    if (columnIndex == null) {
      warnings.push(`Hole ${holeNumber} column not found in grid — left blank.`);
    }

    const par = columnIndex != null ? parValues[columnIndex] : null;
    const strokeIndex = columnIndex != null ? hcpValues[columnIndex] : null;

    if (par == null) {
      warnings.push(`Hole ${holeNumber} par missing — left blank.`);
    }
    if (strokeIndex == null) {
      warnings.push(`Hole ${holeNumber} handicap missing — left blank.`);
    }

    for (const tee of tees) {
      const rowValues = teeValuesByKey.get(tee.teeKey);
      const yardage =
        columnIndex != null && rowValues ? rowValues[columnIndex] : null;
      teeYardages[tee.teeKey] = yardage == null ? "" : String(yardage);
    }

    holes.push({
      holeNumber,
      par: par != null && par >= 3 && par <= 5 ? par : 4,
      strokeIndex:
        strokeIndex != null && strokeIndex >= 1 && strokeIndex <= 18
          ? String(strokeIndex)
          : "",
      teeYardages,
    });
  }

  blankImplausibleTeeOrder(holes, tees, warnings);

  return holes;
}

export async function extractScorecardFromImage(
  imageUrl: string,
  holeCount: number,
  requestedTees: CourseTeeInput[] = []
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
  const content = await callVisionOcr(
    apiKey,
    imageUrl,
    buildSpreadsheetPrompt(holeCount, tees)
  );

  const grid = parseSpreadsheetPayload(content);
  const warnings = [...(grid.warnings ?? [])];
  const { columns, rows } = normalizeGrid(grid);

  if (columns.length === 0) {
    throw new Error("Could not detect scorecard columns. Try a clearer photo.");
  }

  const holes = buildHolesFromGrid(holeCount, tees, columns, rows, warnings);

  const blankYardages = holes.reduce((count, hole) => {
    return (
      count +
      Object.values(hole.teeYardages).filter((value) => !value.trim()).length
    );
  }, 0);

  if (blankYardages > 0) {
    warnings.unshift(
      `${blankYardages} yardage cells were left blank because OCR could not verify them. Fill these manually.`
    );
  }

  return { tees, holes, warnings };
}
