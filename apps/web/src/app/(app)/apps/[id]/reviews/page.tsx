import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RatingsChart } from "@/components/reviews/RatingsChart";
import { RatingsHistogramCard } from "@/components/reviews/RatingsHistogramCard";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { getQueryClient } from "@/lib/get-query-client";
import { presetToRange } from "@/lib/ranges";
import {
  aiStatusOptions,
  ratingsHistogramOptions,
  replyGuidelinesOptions,
  ratingsHistoryOptions,
  reviewsOptions,
} from "@/lib/queries";
import {
  reviewReplyStateParser,
  reviewScoreParser,
  reviewSortParser,
  reviewVersionParser,
} from "@/lib/search-params";
import {
  countsFilters,
  reviewFilters,
  type ReviewView,
} from "@/components/reviews/review-filters";

export default async function ReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    score?: string | string[];
    version?: string | string[];
    replyState?: string | string[];
    sort?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view: ReviewView = {
    score: reviewScoreParser.parseServerSide(sp.score),
    version: reviewVersionParser.parseServerSide(sp.version),
    replyState: reviewReplyStateParser.parseServerSide(sp.replyState),
    sort: reviewSortParser.parseServerSide(sp.sort),
  };

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(reviewsOptions(id, {})),
    queryClient.prefetchQuery(reviewsOptions(id, reviewFilters(view))),
    queryClient.prefetchQuery(reviewsOptions(id, countsFilters(view))),
    queryClient.prefetchQuery(ratingsHistoryOptions(id, presetToRange("30d"))),
    queryClient.prefetchQuery(ratingsHistogramOptions(id)),
    queryClient.prefetchQuery(aiStatusOptions),
  ]);
  void queryClient.prefetchQuery(replyGuidelinesOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="page-wide flex flex-col gap-6">
        <RatingsChart id={id} />
        <Suspense fallback={null}>
          <RatingsHistogramCard id={id} />
        </Suspense>
        <ReviewsList id={id} />
      </div>
    </HydrationBoundary>
  );
}
