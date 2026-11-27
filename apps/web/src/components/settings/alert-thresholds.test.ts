import { describe, expect, it } from "vitest";
import { translationContext } from "@/test/translation-context";
import {
  parseRankDropThreshold,
  rankTextOf,
  rankThresholdChange,
  rankThresholdError,
  rankThresholdToSend,
  thresholdBadge,
} from "./alert-thresholds";

const en = translationContext("en", "notifications").translator;
const zh = translationContext("zh-CN", "notifications").translator;
const enValidation = translationContext("en", "validation").translator;
const zhValidation = translationContext("zh-CN", "validation").translator;
const enError = "Enter a whole number from 1 to 200";
const zhError = "请输入 1 到 200 之间的整数";

describe("parseRankDropThreshold", () => {
  it.each(["", "   "])("reads %j as the instance value", (text) => {
    expect(parseRankDropThreshold(text, enValidation)).toEqual({
      value: null,
      error: null,
    });
  });

  it.each([
    ["10", 10],
    ["1", 1],
    ["200", 200],
    [" 12 ", 12],
  ])("reads %j as %p", (text, value) => {
    expect(parseRankDropThreshold(text, enValidation)).toEqual({
      value,
      error: null,
    });
  });

  it.each(["0", "201", "1.5", "-3", "ten", "1e2"])("refuses %j", (text) => {
    expect(parseRankDropThreshold(text, enValidation)).toEqual({
      value: null,
      error: enError,
    });
  });

  it("names the bounds in its error", () => {
    expect(parseRankDropThreshold("0", enValidation).error).toBe(enError);
    expect(parseRankDropThreshold("0", zhValidation).error).toBe(zhError);
  });
});

describe("rankThresholdToSend", () => {
  it("sends the value only while Rank dropped is on and filled", () => {
    expect(rankThresholdToSend(["rank.dropped"], "10")).toBe(10);
    expect(rankThresholdToSend(["rank.dropped"], "")).toBeUndefined();
    expect(rankThresholdToSend(["rank.first"], "10")).toBeUndefined();
  });

  it("refuses an invalid value only while Rank dropped is on", () => {
    expect(rankThresholdError(["rank.dropped"], "0", enValidation)).toBe(
      enError,
    );
    expect(rankThresholdError(["rank.first"], "0", enValidation)).toBeNull();
  });
});

describe("thresholdBadge", () => {
  it("names the threshold of a rule", () => {
    expect(thresholdBadge("rank.dropped", 10, en)).toBe("Rank dropped · 10+");
    expect(thresholdBadge("rating.dropped", 2, en)).toBe(
      "Rating dropped · 0.2 stars",
    );
  });

  it("localizes the event and rating threshold", () => {
    expect(thresholdBadge("rank.dropped", 10, zh)).toBe("排名下降 · 10+");
    expect(thresholdBadge("rating.dropped", 2, zh)).toBe("评分下降 · 0.2 星");
  });
});

describe("rankThresholdChange", () => {
  it("sends only a changed value while Rank dropped is on", () => {
    expect(rankThresholdChange(["rank.dropped"], "10", 10)).toEqual({});
    expect(rankThresholdChange(["rank.dropped"], "12", 10)).toEqual({
      rankDropThreshold: 12,
    });
    expect(rankThresholdChange(["rank.dropped"], "", 10)).toEqual({
      rankDropThreshold: null,
    });
    expect(rankThresholdChange(["rank.first"], "12", 10)).toEqual({});
  });

  it("writes a saved value back as text", () => {
    expect(rankTextOf(10)).toBe("10");
    expect(rankTextOf(null)).toBe("");
  });
});
