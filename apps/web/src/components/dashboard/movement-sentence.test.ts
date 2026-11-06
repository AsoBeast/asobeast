import { describe, expect, it } from "vitest";
import type { PortfolioInsights } from "@asobeast/shared";
import { appsThatMoved, movementSentence } from "./movement-sentence";

const movement = (up: number, down: number, entered = 0, lost = 0) => ({
  up,
  down,
  entered,
  lost,
});

describe("movementSentence", () => {
  it("says no keyword moved once a week of history exists", () => {
    expect(movementSentence(movement(0, 0), 3, true)).toBe(
      "No keyword moved in the last 7 days.",
    );
  });

  it("says when movement will appear before a week of history", () => {
    expect(movementSentence(movement(0, 0), 3, false)).toBe(
      "Movement appears after a week of daily runs.",
    );
  });

  it("names climbers, fallers and the apps they span", () => {
    expect(movementSentence(movement(4, 3, 1, 1), 5, true)).toBe(
      "In the last 7 days 4 keywords climbed and 3 fell across 5 apps.",
    );
  });

  it("leaves the app count out for a single app", () => {
    expect(movementSentence(movement(1, 0), 1, true)).toBe(
      "In the last 7 days 1 keyword climbed.",
    );
  });

  it("counts a fall alone with its noun", () => {
    expect(movementSentence(movement(0, 2), 2, true)).toBe(
      "In the last 7 days 2 keywords fell across 2 apps.",
    );
  });
});

describe("appsThatMoved", () => {
  it("counts only the apps with a keyword that climbed or fell", () => {
    const insight = (appId: string, up: number, down: number) => ({
      appId,
      movement: movement(up, down),
    });
    const insights = {
      apps: [insight("a", 4, 0), insight("b", 0, 0), insight("c", 0, 1)],
    } as unknown as PortfolioInsights;
    expect(appsThatMoved(insights)).toBe(2);
  });
});
