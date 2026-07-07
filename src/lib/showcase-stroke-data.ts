import type { ScoreEntryGroup } from "@/lib/scoring";
import { previewParByHole } from "@/lib/landing-preview-data";

export const PHONE_NATIVE_WIDTH = 390;

export const SHOWCASE_STROKE_EVENT = {
  slug: "preview-stroke",
  eventName: "Stroke Play Test Tournament",
  format: "stroke" as const,
  code: "SHOW01",
};

export const showcaseStrokeGroup: ScoreEntryGroup = {
  id: "showcase-group-1",
  label: "Group 1",
  teeTime: "9:00 AM",
  matchType: null,
  isTeam: false,
  entrySides: [],
  players: [
    { id: "showcase-tw", name: "Tiger Woods" },
    { id: "showcase-bh", name: "Ben Hogan" },
    { id: "showcase-ap", name: "Arnold Palmer" },
    { id: "showcase-jn", name: "Jack Nicklaus" },
  ],
};

function strokeForHole(hole: number, par: number, offset: number) {
  return par + (hole % 3 === 0 ? -1 : hole % 4 === 0 ? 1 : 0) + offset;
}

const playerOffsets = [0, 1, -1, 2];

export const showcaseStrokeInitialScores: Record<
  string,
  Record<number, number>
> = Object.fromEntries(
  showcaseStrokeGroup.players.map((player, playerIndex) => [
    player.id,
    Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => {
        const hole = i + 1;
        const par = previewParByHole[hole] ?? 4;
        return [hole, strokeForHole(hole, par, playerOffsets[playerIndex] ?? 0)];
      })
    ),
  ])
);

export const showcaseStrokeHoleNumbers = Array.from(
  { length: 18 },
  (_, i) => i + 1
);

export { previewParByHole as showcaseParByHole };

export const showcaseYardageByHole: Record<number, number> = Object.fromEntries(
  Array.from({ length: 18 }, (_, index) => {
    const hole = index + 1;
    return [hole, 350 + index * 12];
  })
);

/** iPhone screen area below the notch at native 390px width (844 − 44pt). */
export const SHOWCASE_SCORE_NATIVE_HEIGHT = 800;
export const SHOWCASE_LEADERBOARD_NATIVE_HEIGHT = 640;
