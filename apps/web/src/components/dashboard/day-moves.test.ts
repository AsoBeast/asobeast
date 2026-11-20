import { describe, expect, it } from "vitest";
import type {
  PortfolioAppHistory,
  PortfolioHistoryPoint,
} from "@asobeast/shared";
import { dayChanges, dayMovements } from "./day-moves";

const point = (
  date: string,
  visibility: number,
  rest: Partial<PortfolioHistoryPoint> = {},
): PortfolioHistoryPoint => ({
  date,
  visibility,
  top10: 0,
  climbed: 0,
  fell: 0,
  ...rest,
});

const app = (
  appId: string,
  points: PortfolioHistoryPoint[],
): PortfolioAppHistory => ({
  appId,
  points,
  change: {
    visibility: 0,
    visibilityDelta: null,
    top10: 0,
    top10Delta: null,
    movement: { up: 0, down: 0, entered: 0, lost: 0 },
  },
  lastRun: { up: 0, down: 0, entered: 0, lost: 0 },
});

const APPS = [
  app("rose", [
    point("2026-07-01", 40.2, { top10: 3 }),
    point("2026-07-02", 42.4, { top10: 3, climbed: 2, fell: 1 }),
  ]),
  app("fell", [
    point("2026-07-01", 41),
    point("2026-07-02", 33.6, { top10: 1, fell: 4 }),
  ]),
  app("steady", [point("2026-07-01", 20.4), point("2026-07-02", 19.6)]),
  app("unchecked", [point("2026-07-01", 12)]),
];

describe("dayChanges", () => {
  it("lists each app's change against its previous check, largest first", () => {
    expect(dayChanges(APPS, "2026-07-02", "visibility")).toEqual([
      { appId: "fell", change: -7 },
      { appId: "rose", change: 2 },
    ]);
    expect(dayChanges(APPS, "2026-07-02", "top10")).toEqual([
      { appId: "fell", change: 1 },
    ]);
  });

  it("answers nothing on an app's first charted day", () => {
    expect(dayChanges(APPS, "2026-07-01", "visibility")).toEqual([]);
  });
});

describe("dayMovements", () => {
  it("lists the apps whose keywords moved that day, busiest first", () => {
    expect(dayMovements(APPS, "2026-07-02")).toEqual([
      { appId: "fell", up: 0, down: 4 },
      { appId: "rose", up: 2, down: 1 },
    ]);
    expect(dayMovements(APPS, "2026-07-01")).toEqual([]);
  });
});
