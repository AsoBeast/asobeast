import type { CompetitorItem, Store } from "@asobeast/shared";

export const BENCHMARK_MIN_COMPETITORS = 3;
export const BENCHMARK_MAX_COMPETITORS = 10;

export interface CompetitorBenchmark {
  median: number;
  count: number;
}

export type BenchmarkOutcome =
  | { kind: "pending" }
  | { kind: "retry" }
  | { kind: "too-few" }
  | { kind: "median"; benchmark: CompetitorBenchmark };

export interface BenchmarkReads {
  averages: readonly (number | null)[];
  loading: number;
  failed: number;
}

export function medianOf(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

const figuresOf = (averages: readonly (number | null)[]): number[] =>
  averages.filter((average): average is number => average !== null);

export function competitorBenchmark(
  averages: readonly (number | null)[],
): CompetitorBenchmark | null {
  const figures = figuresOf(averages);
  const median =
    figures.length >= BENCHMARK_MIN_COMPETITORS ? medianOf(figures) : null;
  return median === null ? null : { median, count: figures.length };
}

export function benchmarkTargets(
  competitors: readonly CompetitorItem[],
  store: Store,
): string[] {
  return competitors
    .filter(
      (competitor) => competitor.store === store && !competitor.delistedAt,
    )
    .slice(0, BENCHMARK_MAX_COMPETITORS)
    .map((competitor) => competitor.id);
}

export function benchmarkOutcome({
  averages,
  loading,
  failed,
}: BenchmarkReads): BenchmarkOutcome {
  if (loading > 0) return { kind: "pending" };
  const benchmark = competitorBenchmark(averages);
  if (benchmark) return { kind: "median", benchmark };
  const reachable = figuresOf(averages).length + failed;
  return failed > 0 && reachable >= BENCHMARK_MIN_COMPETITORS
    ? { kind: "retry" }
    : { kind: "too-few" };
}
