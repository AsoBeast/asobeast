"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import type { Store } from "@asobeast/shared";
import {
  failedRead,
  InlineQueryError,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import { GradedNumber } from "@/components/ui/graded";
import { InfoTip } from "@/components/ui/info-tip";
import { formatRating } from "@/lib/format";
import { grade } from "@/lib/grade";
import { competitorsOptions, ratingsHistoryOptions } from "@/lib/queries";
import { presetDays, presetToRange, type RatingsRange } from "@/lib/ranges";
import {
  BENCHMARK_MIN_COMPETITORS,
  benchmarkOutcome,
  benchmarkTargets,
} from "./competitor-benchmark";
import { newRatingsAverageFor } from "./new-ratings-average";
import {
  benchmarkParts,
  NEW_RATINGS_GUIDE,
  tooFewCompetitors,
} from "./new-ratings-copy";

function ReservedLine() {
  return <span aria-hidden className="block h-lh text-body" />;
}

function BenchmarkHelp() {
  return (
    <InfoTip
      label="About the competitor benchmark"
      title="Competitor benchmark"
      summary="The middle value of the new ratings average of up to 10 of your tracked competitors over the same range, the first ones you added that the store still lists. Competitors with too few new ratings are left out, and nothing is compared below three. On the App Store, apps with very many ratings often have no figure over a short range."
    >
      <a
        href={NEW_RATINGS_GUIDE}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read how the benchmark is worked out
      </a>
    </InfoTip>
  );
}

const retryOf = (reads: readonly RetryableRead[]): RetryableRead => ({
  data: undefined,
  isError: true,
  isFetching: reads.some((read) => read.isFetching),
  errorUpdatedAt: Math.max(...reads.map((read) => read.errorUpdatedAt)),
  refetch: () => Promise.all(reads.map((read) => read.refetch())),
});

export function CompetitorBenchmark({
  id,
  store,
  range,
}: {
  id: string;
  store: Store;
  range: RatingsRange;
}) {
  const bounds = presetToRange(range);
  const list = useQuery(competitorsOptions(id));
  const own = useQuery(ratingsHistoryOptions(id, bounds));
  const targets = benchmarkTargets(list.data ?? [], store);
  const enabled = targets.length >= BENCHMARK_MIN_COMPETITORS;
  const reads = useQueries({
    queries: targets.map((competitor) => ({
      ...ratingsHistoryOptions(competitor, bounds),
      enabled,
    })),
  });

  if (failedRead(list)) {
    return (
      <InlineQueryError message="Competitors could not load." read={list} />
    );
  }
  if (list.data === undefined || !enabled) return null;

  const failed = reads.filter(failedRead);
  const outcome = benchmarkOutcome({
    averages: reads.map((read) =>
      read.data
        ? (newRatingsAverageFor(store, read.data.points)?.average ?? null)
        : null,
    ),
    loading: reads.filter(
      (read) => read.data === undefined && !failedRead(read),
    ).length,
    failed: failed.length,
  });

  if (outcome.kind === "pending") return <ReservedLine />;
  if (outcome.kind === "retry") {
    return (
      <InlineQueryError
        message="Competitor ratings could not load."
        read={retryOf(failed)}
      />
    );
  }
  if (outcome.kind === "too-few") {
    return (
      <p key="too-few" className="text-body">
        <span>{`${tooFewCompetitors} `}</span>
        <BenchmarkHelp />
      </p>
    );
  }
  const ownAverage = own.data
    ? (newRatingsAverageFor(store, own.data.points)?.average ?? null)
    : null;
  const { median, count } = outcome.benchmark;
  const [lead, value, middle] = benchmarkParts(
    median,
    count,
    presetDays(range),
    ownAverage,
  );
  return (
    <p key="median" className="text-body">
      <span>{`${lead} `}</span>
      <GradedNumber
        value={formatRating(value)}
        grade={grade("rating", value)}
        label="Competitors' median new ratings average"
      />
      <span>{` ${middle}. `}</span>
      <BenchmarkHelp />
    </p>
  );
}
