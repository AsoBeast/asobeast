import { describe, expect, it } from "vitest";
import {
  byMagnitude,
  daysPeriod,
  lastRunPeriod,
  moverChange,
} from "./mover-change";

const mover = (text: string, from: number | null, to: number | null) => ({
  keywordId: text,
  text,
  from,
  to,
  fromDepth: 200,
  toDepth: 200,
});

describe("moverChange", () => {
  it("reads a lower position as a climb", () => {
    expect(moverChange(mover("a", 14, 6))).toEqual({
      kind: "up",
      size: 8,
      share: 0.4,
    });
  });

  it("reads a higher position as a fall", () => {
    expect(moverChange(mover("a", 21, 27))).toEqual({
      kind: "down",
      size: 6,
      share: 0.3,
    });
  });

  it("caps the bar at twenty positions", () => {
    expect(moverChange(mover("a", 90, 3)).share).toBe(1);
  });

  it("names a keyword that started or stopped ranking", () => {
    expect(moverChange(mover("a", null, 18))).toEqual({
      kind: "new",
      share: 1,
    });
    expect(moverChange(mover("a", 8, null))).toEqual({
      kind: "lost",
      share: 1,
    });
  });
});

describe("mover periods", () => {
  it("writes English and Chinese periods for the selected range", () => {
    expect(daysPeriod(7)).toEqual({
      within: "in 7 days",
      span: "in the last 7 days",
    });
    expect(daysPeriod(7, "zh-CN")).toEqual({
      within: "在 7 天内",
      span: "在过去 7 天内",
    });
  });

  it("writes the last-run period in both locales", () => {
    expect(lastRunPeriod().within).toBe("in the last run");
    expect(lastRunPeriod("zh-CN").within).toBe("在上次运行中");
  });
});

describe("byMagnitude", () => {
  it("puts arrivals and exits first, then the largest moves", () => {
    const sorted = byMagnitude([
      mover("small", 9, 7),
      mover("lost", 8, null),
      mover("big", 21, 27),
      mover("new", null, 18),
    ]);
    expect(sorted.map((entry) => entry.text)).toEqual([
      "lost",
      "new",
      "big",
      "small",
    ]);
  });
});
