import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { AnnotationsCard } from "@/components/annotations/AnnotationsCard";
import { RankingsHeader } from "@/components/rankings/RankingsHeader";
import { RankingsReportHeader } from "@/components/rankings/RankingsReportHeader";
import { RankingsView } from "@/components/rankings/RankingsView";
import { SerpMoversCard } from "@/components/rankings/SerpMoversCard";
import {
  RankingChartSkeleton,
  RankingsHeaderSkeleton,
} from "@/components/rankings/skeletons";
import { selectionForMarket } from "@/components/rankings/selection";
import { getQueryClient } from "@/lib/get-query-client";
import {
  annotationsOptions,
  keywordCountriesOptions,
  keywordsOptions,
  rankingsOptions,
  serpMoversOptions,
} from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import {
  countryParser,
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
    country?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const range = rangeParser.parseServerSide(sp.range);
  const selected = keywordIdsParser.parseServerSide(sp.keywords);
  const moverDays = moverDaysParser.parseServerSide(sp.movers);
  const country = countryParser.parseServerSide(sp.country);

  const queryClient = getQueryClient();
  const [tracked] = await Promise.all([
    queryClient.fetchQuery(keywordsOptions(id)),
    queryClient.fetchQuery(keywordCountriesOptions(id)).catch(() => null),
  ]);
  const scoped = country
    ? tracked.filter((item) => item.country === country)
    : tracked;
  const effective = selectionForMarket(scoped, selected);

  void queryClient.prefetchQuery(
    rankingsOptions(id, { ...presetToRange(range), keywordIds: effective }),
  );
  void queryClient.prefetchQuery(serpMoversOptions(id, moverDays, country));
  await queryClient.prefetchQuery(annotationsOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="@container/rankings page-full flex flex-col gap-6">
        <Suspense fallback={<RankingsHeaderSkeleton />}>
          <RankingsHeader id={id} />
        </Suspense>
        <Suspense fallback={null}>
          <RankingsReportHeader id={id} />
        </Suspense>
        <div className="grid gap-6 @5xl/rankings:grid-cols-12 print:grid-cols-1 [&>*]:min-w-0">
          <div className="@5xl/rankings:col-span-8 print:col-span-1">
            <Suspense fallback={<RankingChartSkeleton />}>
              <RankingsView id={id} />
            </Suspense>
          </div>
          <div className="flex flex-col gap-6 @5xl/rankings:col-span-4 print:col-span-1">
            <SerpMoversCard id={id} />
            <AnnotationsCard id={id} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
