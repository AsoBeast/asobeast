import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import {
  competitorsCaption,
  formatShare,
  shareLine,
  shareReason,
} from "./share-of-voice-text";

const en = translationContext("en", "overview");
const zh = translationContext("zh-CN", "overview");

describe("shareLine", () => {
  it("writes a share with one decimal", () => {
    expect(shareLine({ current: 42, delta7d: 3.5, competitors: 1 }, en)).toBe(
      "42.0%",
    );
    expect(formatShare(49.25)).toBe("49.3%");
  });

  it.each([
    ["noCompetitors", "Add a competitor to see your share of voice"],
    ["notChecked", "Your competitors have not been checked yet"],
    ["nobodyRanks", "Nobody ranks for these keywords yet"],
  ] as const)("says why there is no share for %s", (reason, text) => {
    expect(
      shareLine({ current: null, delta7d: null, competitors: 0, reason }, en),
    ).toBe(text);
    expect(shareReason(reason, en.translator)).toBe(text);
  });
});

describe("competitorsCaption", () => {
  it("counts the competitors measured", () => {
    expect(competitorsCaption(1, en.translator)).toBe("vs 1 competitor");
    expect(competitorsCaption(2, en.translator)).toBe("vs 2 competitors");
  });

  it("localizes competitor counts and missing-share reasons in Chinese", () => {
    expect(competitorsCaption(1, zh.translator)).toBe("对比 1 个竞品");
    expect(competitorsCaption(2, zh.translator)).toBe("对比 2 个竞品");
    expect(shareReason("noCompetitors", zh.translator)).toBe(
      "添加竞品以查看您的声量份额",
    );
    expect(shareReason("notChecked", zh.translator)).toBe("尚未检查您的竞品");
    expect(shareReason("nobodyRanks", zh.translator)).toBe(
      "尚无应用在这些关键词上获得排名",
    );
  });
});
