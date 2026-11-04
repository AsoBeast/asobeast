import { describe, expect, it } from "vitest";
import {
  DEFAULT_ZONE_THRESHOLDS,
  isDefaultThresholds,
  parseThresholdInput,
  parseZoneThresholds,
  serializeZoneThresholds,
  KEYWORD_ZONES,
  zoneCounts,
  zoneMeaning,
  zoneOf,
  zoneRule,
  type KeywordZone,
  type ScorePair,
} from "./keyword-zones";

const pair = (popularity: number, difficulty: number): ScorePair => ({
  popularity,
  difficulty,
});

describe("zoneOf", () => {
  it.each<[ScorePair | null, KeywordZone | null]>([
    [pair(62, 18), "quickWins"],
    [pair(20, 25), "quickWins"],
    [pair(20, 26), "worthFighting"],
    [pair(19, 25), "easyPickings"],
    [pair(19, 26), "lowPriority"],
    [pair(0, 0), "easyPickings"],
    [pair(100, 100), "worthFighting"],
    [null, null],
  ])("places %j in %s at the defaults", (scores, zone) => {
    expect(zoneOf(scores, DEFAULT_ZONE_THRESHOLDS)).toBe(zone);
  });

  it("puts every pair in quick wins at popularity 0 and difficulty 100", () => {
    const open = { popularity: 0, difficulty: 100 };
    for (const scores of [pair(0, 100), pair(100, 0), pair(50, 50)]) {
      expect(zoneOf(scores, open)).toBe("quickWins");
    }
  });

  it("keeps only the best pair in quick wins at popularity 100 and difficulty 0", () => {
    const strict = { popularity: 100, difficulty: 0 };
    expect(zoneOf(pair(100, 0), strict)).toBe("quickWins");
    expect(zoneOf(pair(99, 0), strict)).toBe("easyPickings");
    expect(zoneOf(pair(100, 1), strict)).toBe("worthFighting");
  });

  it("reads custom thresholds", () => {
    expect(zoneOf(pair(25, 22), { popularity: 30, difficulty: 20 })).toBe(
      "lowPriority",
    );
  });
});

describe("zoneCounts", () => {
  it("counts each zone and the unplotted pairs", () => {
    const pairs = [
      pair(62, 18),
      pair(20, 25),
      pair(70, 80),
      pair(10, 10),
      pair(5, 90),
      pair(19, 26),
      null,
    ];
    const counts = zoneCounts(pairs, DEFAULT_ZONE_THRESHOLDS);
    expect(counts).toEqual({
      zones: {
        quickWins: 2,
        worthFighting: 1,
        easyPickings: 1,
        lowPriority: 2,
      },
      unplotted: 1,
    });
    const total =
      Object.values(counts.zones).reduce((sum, n) => sum + n, 0) +
      counts.unplotted;
    expect(total).toBe(pairs.length);
  });

  it("answers zeros for an empty list", () => {
    expect(zoneCounts([], DEFAULT_ZONE_THRESHOLDS)).toEqual({
      zones: {
        quickWins: 0,
        worthFighting: 0,
        easyPickings: 0,
        lowPriority: 0,
      },
      unplotted: 0,
    });
  });
});

describe("zoneRule", () => {
  it.each<[KeywordZone, string]>([
    ["quickWins", "Popularity 20 or more and difficulty 25 or less"],
    ["worthFighting", "Popularity 20 or more and difficulty above 25"],
    ["easyPickings", "Popularity below 20 and difficulty 25 or less"],
    ["lowPriority", "Popularity below 20 and difficulty above 25"],
  ])("words %s at the defaults", (zone, sentence) => {
    expect(zoneRule(zone, DEFAULT_ZONE_THRESHOLDS)).toBe(sentence);
  });

  it("words the current thresholds", () => {
    expect(zoneRule("quickWins", { popularity: 30, difficulty: 40 })).toBe(
      "Popularity 30 or more and difficulty 40 or less",
    );
  });
});

describe("parseThresholdInput", () => {
  it.each([
    ["20", 20],
    [" 7 ", 7],
    ["0", 0],
    ["100", 100],
  ])("reads %j as %s", (text, value) => {
    expect(parseThresholdInput(text)).toBe(value);
  });

  it.each(["", "101", "-1", "2.5", "1e2", "abc", "٣", "20px"])(
    "refuses %j",
    (text) => {
      expect(parseThresholdInput(text)).toBeNull();
    },
  );
});

describe("parseZoneThresholds", () => {
  it("answers the defaults when nothing is stored", () => {
    expect(parseZoneThresholds(null)).toEqual(DEFAULT_ZONE_THRESHOLDS);
  });

  it("reads a stored pair", () => {
    expect(parseZoneThresholds('{"popularity":30,"difficulty":40}')).toEqual({
      popularity: 30,
      difficulty: 40,
    });
  });

  it.each([
    "not json",
    "[]",
    "null",
    '{"popularity":30}',
    '{"popularity":"30","difficulty":40}',
    '{"popularity":300,"difficulty":40}',
    '{"popularity":3.5,"difficulty":40}',
  ])("falls back to the defaults for %j", (raw) => {
    expect(parseZoneThresholds(raw)).toEqual(DEFAULT_ZONE_THRESHOLDS);
  });

  it("round trips a valid value", () => {
    const raw = '{"popularity":12,"difficulty":64}';
    expect(serializeZoneThresholds(parseZoneThresholds(raw))).toBe(raw);
  });
});

describe("isDefaultThresholds", () => {
  it("is true only for the exact defaults", () => {
    expect(isDefaultThresholds({ popularity: 20, difficulty: 25 })).toBe(true);
    expect(isDefaultThresholds({ popularity: 21, difficulty: 25 })).toBe(false);
    expect(isDefaultThresholds({ popularity: 20, difficulty: 24 })).toBe(false);
  });
});

describe("zoneMeaning", () => {
  it("gives each zone its own sentence without dash punctuation", () => {
    const sentences = KEYWORD_ZONES.map(zoneMeaning);
    expect(new Set(sentences).size).toBe(KEYWORD_ZONES.length);
    for (const sentence of sentences) {
      expect(sentence.length).toBeGreaterThan(0);
      expect(sentence).not.toMatch(/[\u2013\u2014]| - /);
    }
  });

  it("words the widest thresholds", () => {
    expect(zoneRule("quickWins", { popularity: 0, difficulty: 100 })).toBe(
      "Popularity 0 or more and difficulty 100 or less",
    );
  });
});
