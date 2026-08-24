import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RankingsView } from "@/components/rankings/RankingsView";
import { SerpMoversCard } from "@/components/rankings/SerpMoversCard";
import { RankingChartSkeleton } from "@/components/rankings/skeletons";
import {
  DEFAULT_SELECTION,
  topByOpportunity,
} from "@/components/rankings/selection";
import { getQueryClient } from "@/lib/get-query-client";
import {
  keywordsOptions,
  rankingsOptions,
  serpMoversOptions,
} from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import {
  keywordIdsParser,
  moverDaysParser,
  rangeParser,
} from "@/lib/search-params";

export default async function RankingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    range?: string | string[];
    keywords?: string | string[];
    movers?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range = rangeParser.parseServerSide(sp.range);
  const selected = keywordIdsParser.parseServerSide(sp.keywords);
  const moverDays = moverDaysParser.parseServerSide(sp.movers);

  const queryClient = getQueryClient();
  const tracked = await queryClient.fetchQuery(keywordsOptions(id));
  const effective =
    selected.length > 0
      ? selected
      : topByOpportunity(tracked, DEFAULT_SELECTION);

  void queryClient.prefetchQuery(
    rankingsOptions(id, { ...presetToRange(range), keywordIds: effective }),
  );
  void queryClient.prefetchQuery(serpMoversOptions(id, moverDays));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-full grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="lg:col-span-2">
          <Suspense fallback={<RankingChartSkeleton />}>
            <RankingsView id={id} />
          </Suspense>
        </div>
        <SerpMoversCard id={id} />
      </div>
    </HydrationBoundary>
  );
}
