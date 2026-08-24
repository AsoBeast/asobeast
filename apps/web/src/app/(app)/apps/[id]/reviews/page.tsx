import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RatingsChart } from "@/components/reviews/RatingsChart";
import { RatingsHistogramCard } from "@/components/reviews/RatingsHistogramCard";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { getQueryClient } from "@/lib/get-query-client";
import { presetToRange } from "@/lib/ranges";
import {
  ratingsHistogramOptions,
  ratingsHistoryOptions,
  reviewsOptions,
} from "@/lib/queries";
import { reviewScoreParser, reviewVersionParser } from "@/lib/search-params";

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    score?: string | string[];
    version?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const score = reviewScoreParser.parseServerSide(sp.score);
  const version = reviewVersionParser.parseServerSide(sp.version);

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(reviewsOptions(id, {})),
    queryClient.prefetchQuery(
      reviewsOptions(id, {
        score: score ?? undefined,
        version: version || undefined,
      }),
    ),
    queryClient.prefetchQuery(ratingsHistoryOptions(id, presetToRange("30d"))),
    queryClient.prefetchQuery(ratingsHistogramOptions(id)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <RatingsChart id={id} />
        <RatingsHistogramCard id={id} />
        <ReviewsList id={id} />
      </div>
    </HydrationBoundary>
  );
}
