import { describe, expect, it } from "vitest";
import type { CompetitorGapKeyword } from "@asobeast/shared";
import { gapSortValue, leadText, threatText } from "./gap-columns";

const row = (
  over: Partial<CompetitorGapKeyword> = {},
): CompetitorGapKeyword => ({
  keywordId: "kw-2",
  text: "pomodoro",
  volume: 70,
  difficulty: 70,
  opportunity: 31,
  yourPosition: 12,
  bestCompetitorPosition: 4,
  bestCompetitorId: "comp-1",
  gap: null,
  ...over,
});

describe("threatText", () => {
  it("says how far a closing competitor rose", () => {
    expect(threatText(row({ threat: "closing", competitorDelta: 3 }))).toBe(
      "Closing in, rose 3",
    );
  });

  it("says a closing competitor is newly ranked", () => {
    expect(threatText(row({ threat: "closing", competitorDelta: null }))).toBe(
      "Closing in, newly ranked",
    );
  });

  it("names the day a competitor overtook the app", () => {
    expect(
      threatText(row({ threat: "overtook", overtookOn: "2026-11-01" })),
    ).toBe("Overtook you on Nov 1");
  });

  it("writes the day with the formatter it is given", () => {
    expect(
      threatText(
        row({ threat: "overtook", overtookOn: "2026-11-01" }),
        (day) => `day ${day}`,
      ),
    ).toBe("Overtook you on day 2026-11-01");
  });
});

describe("leadText", () => {
  it("says the margin", () => {
    expect(leadText(row({ gap: 6 }))).toBe("6 ahead");
  });

  it("says nobody else ranks", () => {
    expect(leadText(row({ gap: null }))).toBe("No competitor ranks");
  });
});

describe("gapSortValue", () => {
  it("sorts a missing position last", () => {
    expect(gapSortValue("yours", row({ yourPosition: null }))).toBeUndefined();
    expect(gapSortValue("theirs", row())).toBe(4);
  });

  it("sorts an overtake before a competitor closing in", () => {
    expect(gapSortValue("reason", row({ threat: "overtook" }))).toBeLessThan(
      gapSortValue("reason", row({ threat: "closing" })) ?? 0,
    );
  });

  it("sorts a lead without margin last", () => {
    expect(gapSortValue("margin", row({ gap: null }))).toBeUndefined();
  });
});
