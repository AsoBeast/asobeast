import { describe, expect, it } from "vitest";
import type { CompetitorItem } from "@asobeast/shared";
import {
  BENCHMARK_MAX_COMPETITORS,
  BENCHMARK_MIN_COMPETITORS,
  benchmarkOutcome,
  benchmarkTargets,
  competitorBenchmark,
  medianOf,
} from "./competitor-benchmark";

const competitor = (
  id: string,
  overrides: Partial<CompetitorItem> = {},
): CompetitorItem => ({
  id,
  store: "APP_STORE",
  name: id,
  iconUrl: null,
  latestSnapshot: null,
  ...overrides,
});

const rivals = (count: number): CompetitorItem[] =>
  Array.from({ length: count }, (_, index) => competitor(`comp-${index + 1}`));

describe("medianOf", () => {
  it("answers the middle value of an odd count", () => {
    expect(medianOf([4.5, 4.1, 4.7])).toBe(4.5);
  });

  it("answers the mean of the two middle values of an even count", () => {
    expect(medianOf([4.7, 4.1, 4.5, 4.3])).toBeCloseTo(4.4, 9);
  });

  it("answers the value of one", () => {
    expect(medianOf([4.2])).toBe(4.2);
  });

  it("answers null for none", () => {
    expect(medianOf([])).toBeNull();
  });

  it("leaves its input alone", () => {
    const values = [4.7, 4.1, 4.5];
    medianOf(values);

    expect(values).toEqual([4.7, 4.1, 4.5]);
  });
});

describe("competitorBenchmark", () => {
  it("answers the median and how many figures it covers from three", () => {
    expect(competitorBenchmark([4.1, 4.5, 4.7])).toEqual({
      median: 4.5,
      count: 3,
    });
  });

  it("leaves competitors without a figure out", () => {
    expect(competitorBenchmark([4.1, null, 4.5, 4.7])).toEqual({
      median: 4.5,
      count: 3,
    });
  });

  it("answers nothing under three figures", () => {
    expect(competitorBenchmark([4.1, null, 4.5, null])).toBeNull();
    expect(competitorBenchmark([])).toBeNull();
    expect(competitorBenchmark([null, null, null])).toBeNull();
  });

  it("counts every figure up to the cap", () => {
    const figures = Array.from(
      { length: BENCHMARK_MAX_COMPETITORS },
      (_, index) => 4 + index / 10,
    );

    expect(competitorBenchmark(figures)?.count).toBe(BENCHMARK_MAX_COMPETITORS);
  });

  it("asks for three", () => {
    expect(BENCHMARK_MIN_COMPETITORS).toBe(3);
    expect(BENCHMARK_MAX_COMPETITORS).toBe(10);
  });
});

describe("benchmarkTargets", () => {
  it("keeps the API order and the first ten", () => {
    expect(benchmarkTargets(rivals(12), "APP_STORE")).toEqual(
      rivals(10).map(({ id }) => id),
    );
  });

  it("skips a delisted competitor", () => {
    expect(
      benchmarkTargets(
        [
          competitor("a"),
          competitor("b", { delistedAt: "2026-11-01T00:00:00.000Z" }),
          competitor("c"),
          competitor("d", { delistedAt: null }),
        ],
        "APP_STORE",
      ),
    ).toEqual(["a", "c", "d"]);
  });

  it("skips a competitor of another store", () => {
    const mixed = [competitor("a"), competitor("b", { store: "GOOGLE_PLAY" })];

    expect(benchmarkTargets(mixed, "APP_STORE")).toEqual(["a"]);
    expect(benchmarkTargets(mixed, "GOOGLE_PLAY")).toEqual(["b"]);
  });

  it("takes ten after skipping", () => {
    const delisted = new Set([2, 5, 7]);
    const competitors = Array.from({ length: 13 }, (_, index) =>
      competitor(`comp-${index + 1}`, {
        delistedAt: delisted.has(index + 1) ? "2026-11-01T00:00:00.000Z" : null,
      }),
    );
    const targets = benchmarkTargets(competitors, "APP_STORE");

    expect(targets).toHaveLength(10);
    expect(targets.at(-1)).toBe("comp-13");
  });

  it("answers none for no competitors", () => {
    expect(benchmarkTargets([], "APP_STORE")).toEqual([]);
  });
});

describe("benchmarkOutcome", () => {
  it("waits while a read is out", () => {
    expect(
      benchmarkOutcome({ averages: [4.1, 4.5, 4.7], loading: 1, failed: 0 }),
    ).toEqual({ kind: "pending" });
  });

  it("says the median when three figures are in", () => {
    expect(
      benchmarkOutcome({
        averages: [4.1, 4.5, 4.7, null],
        loading: 0,
        failed: 1,
      }),
    ).toEqual({ kind: "median", benchmark: { median: 4.5, count: 3 } });
  });

  it("says too few when thin competitors are the reason", () => {
    expect(
      benchmarkOutcome({
        averages: [4.1, 4.5, null, null],
        loading: 0,
        failed: 0,
      }),
    ).toEqual({ kind: "too-few" });
  });

  it("offers a retry when failed reads could reach the floor", () => {
    expect(
      benchmarkOutcome({
        averages: [4.1, 4.5, null, null],
        loading: 0,
        failed: 2,
      }),
    ).toEqual({ kind: "retry" });
    expect(
      benchmarkOutcome({ averages: [null, null, null], loading: 0, failed: 3 }),
    ).toEqual({ kind: "retry" });
  });

  it("says too few when failures could not change it", () => {
    expect(
      benchmarkOutcome({ averages: [4.1, null, null], loading: 0, failed: 1 }),
    ).toEqual({ kind: "too-few" });
  });
});
