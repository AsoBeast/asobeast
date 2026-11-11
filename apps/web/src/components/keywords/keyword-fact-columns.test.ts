import { describe, expect, it } from "vitest";
import type { ScoreSignals } from "@asobeast/shared";
import { revealColumn } from "./keyword-fact-columns";
import { revealRank } from "./score-signals";

function signals(overrides: Partial<ScoreSignals> = {}): ScoreSignals {
  return {
    suggestReach: "hit",
    suggestPrefixLength: 2,
    suggestPosition: 8,
    serpRelevance: 0.9,
    medianRatingCount: 45_000,
    flags: [],
    officialPopularity: null,
    estimatedTraffic: 5.4,
    ...overrides,
  };
}

describe("reveal column", () => {
  it("is registered hidden by default and reads the reveal rank of a row", () => {
    const column = revealColumn();
    expect(column.id).toBe("reveal");
    expect(column.meta).toMatchObject({ hiddenByDefault: true });
    const accessor = (
      column as unknown as {
        accessorFn: (row: {
          scoreSignals: ScoreSignals | null;
        }) => number | undefined;
      }
    ).accessorFn;
    expect(
      accessor({ scoreSignals: signals({ suggestReach: "listed" }) }),
    ).toBe(revealRank(signals({ suggestReach: "listed" })) ?? undefined);
    expect(accessor({ scoreSignals: null })).toBeUndefined();
  });

  it("sorts dashes last through the table's undefined handling, as every sortable keyword column does", () => {
    const column = revealColumn() as {
      sortFn?: unknown;
      sortUndefined?: unknown;
      sortDescFirst?: unknown;
    };
    expect(column.sortFn).toBe("basic");
    expect(column.sortUndefined).toBe("last");
    expect(column.sortDescFirst).toBe(false);
    const accessor = (
      column as {
        accessorFn: (row: {
          scoreSignals: ScoreSignals | null;
        }) => number | undefined;
      }
    ).accessorFn;
    const dashes = [
      accessor({ scoreSignals: signals({ suggestReach: "unavailable" }) }),
      accessor({ scoreSignals: null }),
    ];
    expect(dashes).toEqual([undefined, undefined]);
  });
});
