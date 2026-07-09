import type {
  PrintableScorecard,
  PrintableScorecardEvent,
} from "@/lib/printable-scorecard";
import {
  getHoleValue,
  STANDARD_SCORECARD_TEE_COLORS,
  sumRange,
} from "@/lib/printable-scorecard";
import { formatHandicapDisplay } from "@/lib/handicap-strokes";

type PrintableScorecardSheetProps = {
  event: PrintableScorecardEvent;
  scorecard: PrintableScorecard;
  qrDataUrl: string;
};

const TEE_YARDAGE_ROWS = [
  { color: "black", label: "Black" },
  { color: "blue", label: "Blue" },
  { color: "white", label: "White" },
  { color: "red", label: "Red" },
] as const satisfies ReadonlyArray<{
  color: (typeof STANDARD_SCORECARD_TEE_COLORS)[number];
  label: string;
}>;

const TEE_ROW_CELL_STYLES: Record<
  (typeof TEE_YARDAGE_ROWS)[number]["color"],
  string
> = {
  black: "bg-neutral-700 text-white print:bg-neutral-700 print:text-white",
  blue: "bg-blue-700 text-white print:bg-blue-700 print:text-white",
  white:
    "bg-white text-neutral-900 print:bg-white print:text-neutral-900",
  red: "bg-red-600 text-white print:bg-red-600 print:text-white",
};

type ScorecardColumn =
  | { kind: "label" }
  | { kind: "hole"; hole: number; index: number }
  | { kind: "out" }
  | { kind: "in" }
  | { kind: "tot" }
  | { kind: "hdcp" }
  | { kind: "net" };

function buildColumns(event: PrintableScorecardEvent): ScorecardColumn[] {
  const holeNumbers = event.holeData.map((hole) => hole.holeNumber);
  const frontNine = holeNumbers.filter((hole) => hole <= 9);
  const backNine = holeNumbers.filter((hole) => hole > 9);
  const isEighteen = event.holes === "18";

  const columns: ScorecardColumn[] = [{ kind: "label" }];

  frontNine.forEach((hole, index) => {
    columns.push({ kind: "hole", hole, index });
  });

  if (isEighteen) {
    columns.push({ kind: "out" });
    backNine.forEach((hole, index) => {
      columns.push({ kind: "hole", hole, index: frontNine.length + index });
    });
    columns.push({ kind: "in" });
  }

  columns.push({ kind: "tot" }, { kind: "hdcp" }, { kind: "net" });
  return columns;
}

function columnKey(column: ScorecardColumn, prefix: string): string {
  if (column.kind === "label") return `${prefix}-label`;
  if (column.kind === "hole") return `${prefix}-hole-${column.hole}`;
  return `${prefix}-${column.kind}`;
}

function columnHeader(column: ScorecardColumn): string {
  switch (column.kind) {
    case "label":
      return "";
    case "hole":
      return String(column.hole);
    case "out":
      return "Out";
    case "in":
      return "In";
    case "tot":
      return "Tot";
    case "hdcp":
      return "Hdcp";
    case "net":
      return "Net";
  }
}

function StrokeDots({ count }: { count: number }) {
  if (count <= 0) return null;

  return (
    <span className="absolute left-[2px] top-[2px] flex flex-col gap-[1px]">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="block size-[3px] rounded-full bg-black"
          aria-hidden
        />
      ))}
    </span>
  );
}

function GridCell({
  children,
  className = "",
  strokeDots = 0,
  header = false,
  fixedHeight = false,
}: {
  children?: React.ReactNode;
  className?: string;
  strokeDots?: number;
  header?: boolean;
  fixedHeight?: boolean;
}) {
  const Tag = header ? "th" : "td";

  return (
    <Tag
      className={`relative border border-black px-0.5 py-1 text-center align-middle tabular-nums leading-none ${fixedHeight ? "h-8 min-h-8" : ""} ${className}`}
    >
      <StrokeDots count={strokeDots} />
      {children ?? (fixedHeight ? "\u00a0" : null)}
    </Tag>
  );
}

function LabelCell({
  children,
  className = "",
  shaded = false,
  fixedHeight = false,
  tinted = false,
}: {
  children: React.ReactNode;
  className?: string;
  shaded?: boolean;
  fixedHeight?: boolean;
  tinted?: boolean;
}) {
  const backgroundClass = tinted
    ? ""
    : shaded
      ? "bg-neutral-100"
      : "bg-white";

  return (
    <td
      className={`border border-black px-2 text-left align-middle text-[9px] font-semibold leading-snug ${fixedHeight ? "h-8 min-h-8 py-1" : "py-1.5"} ${backgroundClass} ${className}`}
    >
      {children}
    </td>
  );
}

function LabelHeader({
  children,
  shaded = false,
  className = "",
}: {
  children: React.ReactNode;
  shaded?: boolean;
  className?: string;
}) {
  return (
    <th
      className={`border border-black px-2 py-1.5 text-left align-middle text-[8px] font-bold leading-snug ${shaded ? "bg-neutral-100" : "bg-white"} ${className}`}
    >
      {children}
    </th>
  );
}

export function PrintableScorecardSheet({
  event,
  scorecard,
  qrDataUrl,
}: PrintableScorecardSheetProps) {
  const columns = buildColumns(event);
  const dataColumns = columns.slice(1);
  const isEighteen = event.holes === "18";

  const totalPar = sumRange(event.holeData, 1, isEighteen ? 18 : 9, "par");
  const outPar = isEighteen ? sumRange(event.holeData, 1, 9, "par") : totalPar;
  const inPar = isEighteen ? sumRange(event.holeData, 10, 18, "par") : null;

  const teeYardageTotals = Object.fromEntries(
    TEE_YARDAGE_ROWS.map(({ color }) => {
      const total = sumRange(event.holeData, 1, isEighteen ? 18 : 9, "yardage", color);
      const out = isEighteen
        ? sumRange(event.holeData, 1, 9, "yardage", color)
        : total;
      const backNine = isEighteen
        ? sumRange(event.holeData, 10, 18, "yardage", color)
        : null;
      return [color, { total, out, backNine }] as const;
    })
  ) as Record<
    (typeof TEE_YARDAGE_ROWS)[number]["color"],
    { total: number | null; out: number | null; backNine: number | null }
  >;

  const playerRows = Array.from(
    { length: scorecard.minPlayerRows },
    (_, index) => scorecard.players[index] ?? null
  );

  function holeCellValue(
    column: ScorecardColumn,
    field: "yardage" | "par" | "strokeIndex",
    teeColor?: string
  ): number | null {
    if (column.kind === "hole") {
      return getHoleValue(event.holeData, column.hole, field, teeColor);
    }
    if (column.kind === "out") {
      if (field === "par") return outPar;
      if (field === "yardage" && teeColor) {
        return teeYardageTotals[teeColor as keyof typeof teeYardageTotals]?.out ?? null;
      }
      return null;
    }
    if (column.kind === "in") {
      if (field === "par") return inPar;
      if (field === "yardage" && teeColor) {
        return teeYardageTotals[teeColor as keyof typeof teeYardageTotals]?.backNine ?? null;
      }
      return null;
    }
    if (column.kind === "tot") {
      if (field === "par") return totalPar;
      if (field === "yardage" && teeColor) {
        return teeYardageTotals[teeColor as keyof typeof teeYardageTotals]?.total ?? null;
      }
      return null;
    }
    return null;
  }

  function renderDataCells(
    field: string,
    options?: {
      player?: PrintableScorecard["players"][number] | null;
      rowIndex?: number;
      playerRow?: boolean;
      teeColor?: string;
      teeRowClass?: string;
    }
  ) {
    const fixedHeight = options?.playerRow ?? options?.player != null;
    const teeRowClass = options?.teeRowClass ?? "";

    return dataColumns.map((column) => {
      if (options?.player != null) {
        if (column.kind === "hdcp") {
          return (
            <GridCell
              key={columnKey(column, `player-${options.rowIndex}`)}
              fixedHeight
            >
              {formatHandicapDisplay(options.player.handicap)}
            </GridCell>
          );
        }
        if (
          column.kind === "net" ||
          column.kind === "out" ||
          column.kind === "in" ||
          column.kind === "tot"
        ) {
          return (
            <GridCell
              key={columnKey(column, `player-${options.rowIndex}`)}
              fixedHeight
            />
          );
        }
        return (
          <GridCell
            key={columnKey(column, `player-${options.rowIndex}`)}
            fixedHeight
            strokeDots={
              column.kind === "hole"
                ? (options.player.strokesByHole[column.index] ?? 0)
                : 0
            }
          />
        );
      }

      if (fixedHeight) {
        return (
          <GridCell
            key={columnKey(column, `${field}-empty-${options?.rowIndex ?? "team"}`)}
            fixedHeight
          />
        );
      }

      if (field === "yardage" || field === "par" || field === "strokeIndex") {
        if (column.kind === "hdcp" || column.kind === "net") {
          return (
            <GridCell
              key={columnKey(column, field)}
              className={teeRowClass}
            />
          );
        }

        const value = holeCellValue(
          column,
          field as "yardage" | "par" | "strokeIndex",
          options?.teeColor
        );
        const isTotalColumn =
          column.kind === "out" ||
          column.kind === "in" ||
          column.kind === "tot";

        return (
          <GridCell
            key={columnKey(column, field)}
            className={`${teeRowClass} ${field !== "strokeIndex" && isTotalColumn ? "font-semibold" : ""}`}
          >
            {value ?? ""}
          </GridCell>
        );
      }

      return (
        <GridCell
          key={columnKey(column, field)}
          fixedHeight={fixedHeight}
        />
      );
    });
  }

  return (
    <section className="print-scorecard-page rounded-xl border border-border bg-white p-3 text-black shadow-sm sm:p-4 print:shadow-none">
      <header className="mb-3 grid gap-3 sm:mb-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] sm:items-start">
        <div className="flex items-center justify-center gap-2 sm:justify-start">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-emerald-700 text-sm font-bold text-white">
            OR
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              OpenRound
            </p>
            <p className="text-[9px] text-neutral-600">Printable scorecard</p>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-base font-bold leading-tight sm:text-lg">
            {event.name}
          </h1>
          <p className="mt-0.5 text-[10px] text-neutral-700">
            {event.courseName} · {event.formatLabel}
          </p>
          {(event.courseAddress || event.teeName) && (
            <p className="mt-0.5 text-[9px] text-neutral-600">
              {[event.courseAddress, event.teeName && `${event.teeName} tees`, event.courseTotalYardage && `${event.courseTotalYardage.toLocaleString()} yds`, event.courseRating && event.courseSlope && `${event.courseRating}/${event.courseSlope}`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          <p className="mt-1 break-all font-mono text-[10px] font-medium sm:text-[11px]">
            {scorecard.displayScoreUrl}
          </p>
          <p className="text-[11px]">
            Code:{" "}
            <span className="font-mono text-sm font-bold tracking-[0.2em]">
              {scorecard.scoringCode}
            </span>
          </p>
          <p className="mt-0.5 text-[9px] text-neutral-600">
            {scorecard.groupLabel}
          </p>
        </div>

        <div className="flex flex-col items-center sm:items-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`QR code for ${scorecard.scoringUrl}`}
            width={96}
            height={96}
            className="size-20 sm:ml-auto sm:size-24"
          />
          <p className="mt-1 text-center text-[8px] leading-tight text-neutral-600 sm:text-right">
            Scan for digital scorecard
          </p>
        </div>
      </header>

      <p className="mb-2 text-center text-[10px] text-muted-foreground sm:hidden print:hidden">
        Swipe sideways to view the full scorecard
      </p>

      <div className="print-scorecard-table-scroll -mx-1 overflow-x-auto overscroll-x-contain px-1 touch-pan-x sm:mx-0 sm:overflow-visible sm:px-0 print:overflow-visible">
        <table className="scorecard-grid w-full min-w-[42rem] table-fixed border-collapse text-[9px] sm:min-w-0 print:min-w-0">
          <colgroup>
            <col style={{ width: "12%" }} />
            {dataColumns.map((column) => (
              <col
                key={columnKey(column, "col")}
                style={{
                  width:
                    column.kind === "hdcp" || column.kind === "net"
                      ? "4%"
                      : "3.35%",
                }}
              />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-neutral-100">
              <LabelHeader shaded className="uppercase tracking-wide">
                Marker scores
              </LabelHeader>
              {dataColumns.map((column) => (
                <GridCell key={columnKey(column, "marker-head")} header>
                  <span className="text-[8px] font-bold uppercase">
                    {columnHeader(column)}
                  </span>
                </GridCell>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <LabelCell>{"\u00a0"}</LabelCell>
              {renderDataCells("marker-body")}
            </tr>
            <tr className="bg-neutral-100">
              <LabelHeader shaded>{scorecard.scheduleLine}</LabelHeader>
              {dataColumns.map((column) => (
                <GridCell key={columnKey(column, "main-head")} header>
                  <span className="text-[8px] font-bold uppercase">
                    {columnHeader(column)}
                  </span>
                </GridCell>
              ))}
            </tr>
            {TEE_YARDAGE_ROWS.map(({ color, label }) => {
              const teeRowClass = TEE_ROW_CELL_STYLES[color];
              return (
                <tr key={color} className={`scorecard-tee-row scorecard-tee-${color}`}>
                  <LabelCell tinted className={teeRowClass}>
                    {label}
                  </LabelCell>
                  {renderDataCells("yardage", {
                    teeColor: color,
                    teeRowClass,
                  })}
                </tr>
              );
            })}
            <tr>
              <LabelCell>Hdcp</LabelCell>
              {renderDataCells("strokeIndex")}
            </tr>
            <tr>
              <LabelCell>Par</LabelCell>
              {renderDataCells("par")}
            </tr>
            {playerRows.map((player, rowIndex) => (
              <tr key={player?.id ?? `row-${rowIndex}`} className="scorecard-player-row">
                <LabelCell fixedHeight>{player?.name ?? "\u00a0"}</LabelCell>
                {renderDataCells(`player-${rowIndex}`, {
                  player,
                  rowIndex,
                  playerRow: true,
                })}
              </tr>
            ))}
            {scorecard.showTeamRow && scorecard.teamRowLabel && (
              <tr className="scorecard-player-row">
                <LabelCell fixedHeight>{scorecard.teamRowLabel}</LabelCell>
                {renderDataCells("team", { playerRow: true })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-[10px] sm:gap-6">
        <div>
          <p className="font-semibold uppercase tracking-wide">Scorer</p>
          <div className="mt-4 border-b border-black" />
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide">Attest</p>
          <div className="mt-4 border-b border-black" />
        </div>
        <div>
          <p className="font-semibold uppercase tracking-wide">Date</p>
          <div className="mt-4 border-b border-black" />
        </div>
      </div>
    </section>
  );
}
