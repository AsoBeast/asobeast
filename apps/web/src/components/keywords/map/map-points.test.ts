import { describe, expect, it } from "vitest";
import type {
  OfficialPopularityState,
  TrackedKeywordItem,
} from "@asobeast/shared";
import { DEFAULT_ZONE_THRESHOLDS, zoneCounts } from "@/lib/keyword-zones";
import { scorePair } from "@/lib/keyword-scores";
import {
  dotLabel,
  dotName,
  labelledIds,
  MAP_LABEL_LIMIT,
  mapPoints,
  placeOverlay,
  type MapPoint,
} from "./map-points";

let nextId = 0;

function keyword(
  scores: Partial<TrackedKeywordItem> & {
    state?: OfficialPopularityState;
  },
): TrackedKeywordItem {
  const { state, ...rest } = scores;
  nextId += 1;
  return {
    keywordId: `kw-${nextId}`,
    text: `keyword ${nextId}`,
    country: "us",
    source: "MANUAL",
    active: true,
    latestPosition: null,
    latestDepth: 200,
    previousPosition: null,
    positionDelta1d: null,
    positionDelta7d: null,
    traffic: null,
    difficulty: null,
    volume: null,
    relevance: null,
    opportunity: null,
    bucket: null,
    scoredAt: null,
    scoreProvenance: null,
    serpVolatility7d: null,
    scoreSignals:
      state === undefined
        ? null
        : {
            suggestReach: "hit",
            suggestPrefixLength: 3,
            suggestPosition: 2,
            serpRelevance: 0.8,
            medianRatingCount: 1,
            flags: [],
            officialPopularity: null,
            estimatedTraffic: null,
            officialPopularityState: state,
          },
    ...rest,
  };
}

const onlyPoint = (item: TrackedKeywordItem): MapPoint => {
  const { points } = mapPoints([item], DEFAULT_ZONE_THRESHOLDS);
  expect(points).toHaveLength(1);
  return points[0];
};

type MapRow = [
  text: string,
  volume: number | null,
  difficulty: number | null,
  position: number | null,
  opportunity: number | null,
  checked: boolean,
];

const APP_MAP_ROWS: MapRow[] = [
  ["focus timer", 62, 1.8, 3, 82, true],
  ["pomodoro app", 48, 2.2, 12, 78, true],
  ["study timer", 35, 1.2, null, 88, true],
  ["deep work timer", 20, 2.5, 41, 45, true],
  ["exam countdown", 27, 2.54, null, 65, true],
  ["habit timer", 55, 2.0, 7, 80, true],
  ["paused phrase", 33, 1.9, 9, 81, true],
  ["world flags", 41, 1.5, null, 85, true],
  ["productivity", 88, 8.4, 64, 16, true],
  ["to do list", 92, 9.1, null, 9, true],
  ["time management", 64, 6.0, 33, 40, true],
  ["planner", 74, 7.5, null, 25, true],
  ["focus app", 58, 2.6, 19, 74, true],
  ["task manager", 71, 7.0, null, 30, true],
  ["flag trivia", 30, 4.0, 25, 60, true],
  ["countdown to exams", 14, 1.0, 2, 34, true],
  ["timer for studying", 9, 0.8, null, 20, true],
  ["pomodoro tracker", 19, 2.4, 5, 43, true],
  ["tiny timer", 4, 0.5, null, 8, true],
  ["timer", 18, 7.8, 120, 12, true],
  ["clock", 6, 9.4, null, 1, true],
  ["countdown", 10, 5.5, null, 11, true],
  ["stopwatch", 19, 2.6, null, 42, true],
  ["new phrase one", null, null, null, null, false],
  ["half scored", 40, null, null, null, true],
];

const appMapKeywords = (): TrackedKeywordItem[] =>
  APP_MAP_ROWS.map(
    ([text, volume, difficulty, latestPosition, opportunity, checked]) =>
      keyword({
        text,
        volume,
        difficulty,
        latestPosition,
        opportunity,
        latestDepth: checked ? 200 : null,
      }),
  );

describe("mapPoints", () => {
  it("plots a ranked keyword at its shown whole numbers", () => {
    expect(
      onlyPoint(
        keyword({
          text: "focus timer",
          volume: 62,
          difficulty: 1.8,
          latestPosition: 3,
          opportunity: 82,
        }),
      ),
    ).toMatchObject({
      text: "focus timer",
      popularity: 62,
      difficulty: 18,
      zone: "quickWins",
      ranked: true,
      positionLabel: "3",
      floor: false,
      opportunity: 82,
    });
  });

  it("names a checked keyword that is not ranking by its depth", () => {
    expect(onlyPoint(keyword({ volume: 35, difficulty: 1.2 }))).toMatchObject({
      ranked: false,
      positionLabel: ">200",
    });
  });

  it("plots a never checked keyword without a position", () => {
    expect(
      onlyPoint(keyword({ volume: 4, difficulty: 0.5, latestDepth: null })),
    ).toMatchObject({ ranked: false, positionLabel: null });
  });

  it.each<[OfficialPopularityState, boolean]>([
    ["floor", true],
    ["absent", true],
    ["listed", false],
  ])("marks the %s popularity state as floor %s", (state, floor) => {
    expect(
      onlyPoint(keyword({ volume: 41, difficulty: 1.5, state })).floor,
    ).toBe(floor);
  });

  it("counts a keyword missing either score as unplotted", () => {
    expect(
      mapPoints(
        [
          keyword({ volume: null, difficulty: 2 }),
          keyword({ volume: 40, difficulty: null }),
        ],
        DEFAULT_ZONE_THRESHOLDS,
      ),
    ).toEqual({ points: [], unplotted: 2 });
  });

  it("clamps a popularity above the scale", () => {
    expect(onlyPoint(keyword({ volume: 5000, difficulty: 2 }))).toMatchObject({
      popularity: 100,
      difficulty: 20,
    });
  });

  it("plots a paused keyword", () => {
    expect(
      onlyPoint(keyword({ volume: 33, difficulty: 1.9, active: false })).active,
    ).toBe(false);
  });

  it("keeps the input order", () => {
    const items = appMapKeywords();
    const { points } = mapPoints(items, DEFAULT_ZONE_THRESHOLDS);
    expect(points.map((point) => point.text)).toEqual(
      APP_MAP_ROWS.slice(0, 23).map(([text]) => text),
    );
  });

  it("splits the opportunity map fixture into its zones", () => {
    const items = appMapKeywords();
    const { points, unplotted } = mapPoints(items, DEFAULT_ZONE_THRESHOLDS);

    expect(points).toHaveLength(23);
    expect(unplotted).toBe(2);
    expect(zoneCounts(items.map(scorePair), DEFAULT_ZONE_THRESHOLDS)).toEqual({
      zones: {
        quickWins: 8,
        worthFighting: 7,
        easyPickings: 4,
        lowPriority: 4,
      },
      unplotted: 2,
    });
    expect(
      points.find((point) => point.text === "exam countdown"),
    ).toMatchObject({ difficulty: 25, zone: "quickWins" });
  });
});

describe("labelledIds", () => {
  const points = () =>
    mapPoints(appMapKeywords(), DEFAULT_ZONE_THRESHOLDS).points;
  const textsOf = (all: MapPoint[], ids: ReadonlySet<string>) =>
    all.filter((point) => ids.has(point.keywordId)).map((point) => point.text);

  it("labels the five highest opportunities and never more", () => {
    const all = points();
    const ids = labelledIds(all, null);

    expect(ids.size).toBe(MAP_LABEL_LIMIT);
    expect(textsOf(all, ids).sort()).toEqual(
      [
        "focus timer",
        "habit timer",
        "paused phrase",
        "study timer",
        "world flags",
      ].sort(),
    );
  });

  it("breaks equal opportunities by text then id", () => {
    const tied = mapPoints(
      ["delta", "alpha", "echo", "charlie", "bravo", "foxtrot"].map(
        (text, index) =>
          keyword({ text, volume: 50, difficulty: 2 + index, opportunity: 70 }),
      ),
      DEFAULT_ZONE_THRESHOLDS,
    ).points;
    const ids = labelledIds(tied, null);

    expect(textsOf(tied, ids).sort()).toEqual([
      "alpha",
      "bravo",
      "charlie",
      "delta",
      "echo",
    ]);
    expect([...labelledIds(tied, null)]).toEqual([...ids]);
  });

  it("labels one of the dots stacked on the same spot and gives the slot to the next", () => {
    const at = (text: string, difficulty: number, opportunity: number) =>
      keyword({ text, volume: 40, difficulty, opportunity });
    const stacked = mapPoints(
      [
        at("seat map pro", 1.5, 77),
        at("red eye fare alerts", 1.5, 77),
        ...["one", "two", "three", "four", "five"].map((text, index) =>
          at(text, 3 + index, 60 - index),
        ),
      ],
      DEFAULT_ZONE_THRESHOLDS,
    ).points;

    expect(textsOf(stacked, labelledIds(stacked, null)).sort()).toEqual(
      ["four", "one", "red eye fare alerts", "three", "two"].sort(),
    );
  });

  it("never labels a point without an opportunity and labels fewer when fewer qualify", () => {
    const few = mapPoints(
      [
        keyword({ text: "scored", volume: 50, difficulty: 2, opportunity: 40 }),
        keyword({
          text: "blank",
          volume: 50,
          difficulty: 2,
          opportunity: null,
        }),
      ],
      DEFAULT_ZONE_THRESHOLDS,
    ).points;

    expect(textsOf(few, labelledIds(few, null))).toEqual(["scored"]);
  });

  it("lets only the chosen zone compete", () => {
    const all = points();

    expect(textsOf(all, labelledIds(all, "worthFighting")).sort()).toEqual(
      [
        "flag trivia",
        "focus app",
        "planner",
        "task manager",
        "time management",
      ].sort(),
    );
  });
});

describe("dotLabel", () => {
  it("keeps a text of 22 characters", () => {
    expect(dotLabel("a".repeat(22))).toBe("a".repeat(22));
  });

  it("cuts a longer text at 22 characters", () => {
    expect(dotLabel("a".repeat(23))).toBe(`${"a".repeat(22)}…`);
  });

  it("cuts by code points, never inside a pair", () => {
    expect(dotLabel("𠮷".repeat(30))).toBe(`${"𠮷".repeat(22)}…`);
  });
});

describe("dotName", () => {
  const point = (overrides: Partial<MapPoint>): MapPoint => ({
    keywordId: "kw-1",
    text: "focus timer",
    country: "us",
    popularity: 62,
    difficulty: 18,
    zone: "quickWins",
    opportunity: 82,
    position: 3,
    depth: 200,
    positionLabel: "3",
    ranked: true,
    floor: false,
    active: true,
    ...overrides,
  });

  it("names a ranked dot in words", () => {
    expect(dotName(point({}), false)).toBe(
      "focus timer, position 3, popularity 62, difficulty 18, opportunity 82, Quick wins",
    );
  });

  it("names an unranked dot by the depth of its row", () => {
    expect(
      dotName(
        point({
          text: "study timer",
          position: null,
          depth: 100,
          positionLabel: ">100",
          ranked: false,
        }),
        false,
      ),
    ).toBe(
      "study timer, not in the top 100, popularity 62, difficulty 18, opportunity 82, Quick wins",
    );
  });

  it("names a never checked dot", () => {
    expect(
      dotName(
        point({
          position: null,
          depth: null,
          positionLabel: null,
          ranked: false,
        }),
        false,
      ),
    ).toContain(", not checked yet, ");
  });

  it("names a floor answer, a pause and a missing opportunity", () => {
    const name = dotName(
      point({ popularity: 41, floor: true, active: false, opportunity: null }),
      false,
    );

    expect(name).toContain("popularity 41, floor answer");
    expect(name).not.toContain("opportunity");
    expect(name.endsWith(", paused")).toBe(true);
  });

  it("adds the market when the page has several", () => {
    expect(dotName(point({}), true).startsWith("focus timer (US), ")).toBe(
      true,
    );
  });
});

describe("placeOverlay", () => {
  const overlay = { width: 224, height: 112 };
  const surface = { width: 800, height: 360 };

  it("places it right of and above a dot with room", () => {
    expect(placeOverlay({ x: 100, y: 200 }, overlay, surface)).toEqual({
      left: 108,
      top: 80,
    });
  });

  it("flips it left near the right edge", () => {
    expect(placeOverlay({ x: 700, y: 200 }, overlay, surface).left).toBe(468);
  });

  it("flips it below near the top", () => {
    expect(placeOverlay({ x: 100, y: 40 }, overlay, surface).top).toBe(48);
  });

  it("keeps it inside a surface too narrow for either side", () => {
    expect(
      placeOverlay({ x: 120, y: 200 }, overlay, { width: 250, height: 360 }),
    ).toEqual({ left: 0, top: 80 });
  });

  it("keeps it inside a surface too short for either side", () => {
    expect(
      placeOverlay({ x: 100, y: 100 }, overlay, { width: 800, height: 180 }),
    ).toEqual({ left: 108, top: 68 });
  });

  it("pins it to the corner of a surface smaller than the overlay", () => {
    expect(
      placeOverlay({ x: 10, y: 10 }, overlay, { width: 100, height: 50 }),
    ).toEqual({ left: 0, top: 0 });
  });
});
