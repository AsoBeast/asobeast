import { describe, expect, it } from "vitest";
import {
  RANK_THRESHOLD_ERROR,
  parseRankDropThreshold,
  rankTextOf,
  rankThresholdChange,
  rankThresholdError,
  rankThresholdToSend,
  thresholdBadge,
} from "./alert-thresholds";

describe("parseRankDropThreshold", () => {
  it.each(["", "   "])("reads %j as the instance value", (text) => {
    expect(parseRankDropThreshold(text)).toEqual({ value: null, error: null });
  });

  it.each([
    ["10", 10],
    ["1", 1],
    ["200", 200],
    [" 12 ", 12],
  ])("reads %j as %p", (text, value) => {
    expect(parseRankDropThreshold(text)).toEqual({ value, error: null });
  });

  it.each(["0", "201", "1.5", "-3", "ten", "1e2"])("refuses %j", (text) => {
    expect(parseRankDropThreshold(text)).toEqual({
      value: null,
      error: RANK_THRESHOLD_ERROR,
    });
  });

  it("names the bounds in its error", () => {
    expect(RANK_THRESHOLD_ERROR).toBe("Enter a whole number from 1 to 200");
  });
});

describe("rankThresholdToSend", () => {
  it("sends the value only while Rank dropped is on and filled", () => {
    expect(rankThresholdToSend(["rank.dropped"], "10")).toBe(10);
    expect(rankThresholdToSend(["rank.dropped"], "")).toBeUndefined();
    expect(rankThresholdToSend(["rank.first"], "10")).toBeUndefined();
  });

  it("refuses an invalid value only while Rank dropped is on", () => {
    expect(rankThresholdError(["rank.dropped"], "0")).toBe(
      RANK_THRESHOLD_ERROR,
    );
    expect(rankThresholdError(["rank.first"], "0")).toBeNull();
  });
});

describe("thresholdBadge", () => {
  it("names the threshold of a rule", () => {
    expect(thresholdBadge("rank.dropped", 10)).toBe("Rank dropped · 10+");
    expect(thresholdBadge("rating.dropped", 2)).toBe(
      "Rating dropped · 0.2 stars",
    );
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
