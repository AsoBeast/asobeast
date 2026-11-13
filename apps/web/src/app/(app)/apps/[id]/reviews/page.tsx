import { Suspense } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { RatingByVersion } from "@/components/reviews/RatingByVersion";
import { RatingsDistribution } from "@/components/reviews/RatingsDistribution";
import { RatingsPanel } from "@/components/reviews/RatingsPanel";
import { ReviewMentions } from "@/components/reviews/ReviewMentions";
import { ReviewsLede } from "@/components/reviews/ReviewsLede";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import {
  REVIEWS_GRID,
  REVIEWS_MAIN,
  REVIEWS_RAIL,
} from "@/components/reviews/layout-classes";
import { LedeSkeleton } from "@/components/reviews/skeletons";
import { RATING_CHANGE_RANGE } from "@/components/overview/rating-trend";
import { getQueryClient } from "@/lib/get-query-client";
import { presetToRange, type RatingsRange } from "@/lib/ranges";
import {
  aiStatusOptions,
  ratingsHistogramOptions,
  replyGuidelinesOptions,
  ratingsHistoryOptions,
  reviewsOptions,
  reviewThemesOptions,
} from "@/lib/queries";
import {
  ratingsRangeParser,
  reviewQueryParser,
  reviewReplyStateParser,
  reviewScoreParser,
  reviewSinceParser,
  reviewSortParser,
  reviewVersionParser,
} from "@/lib/search-params";
import {
  countsFilters,
  REVIEWS_SHOW_ALL_LIMIT,
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
    since?: string | string[];
    replyState?: string | string[];
    sort?: string | string[];
    q?: string | string[];
    range?: string | string[];
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const view: ReviewView = {
    score: reviewScoreParser.parseServerSide(sp.score),
    version: reviewVersionParser.parseServerSide(sp.version),
    since: reviewSinceParser.parseServerSide(sp.since),
    replyState: reviewReplyStateParser.parseServerSide(sp.replyState),
    sort: reviewSortParser.parseServerSide(sp.sort),
  };

  const chartRange = ratingsRangeParser.parseServerSide(sp.range);
  const ranges: RatingsRange[] =
    chartRange === RATING_CHANGE_RANGE
      ? [chartRange]
      : [RATING_CHANGE_RANGE, chartRange];

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(reviewsOptions(id, {})),
    queryClient.prefetchQuery(
      reviewsOptions(
        id,
        reviewFilters(
          view,
          reviewQueryParser.parseServerSide(sp.q).trim()
            ? REVIEWS_SHOW_ALL_LIMIT
            : undefined,
        ),
      ),
    ),
    queryClient.prefetchQuery(reviewsOptions(id, countsFilters(view))),
    queryClient.prefetchQuery(reviewThemesOptions(id, reviewFilters(view))),
    ...ranges.map((range) =>
      queryClient.prefetchQuery(
        ratingsHistoryOptions(id, presetToRange(range)),
      ),
    ),
    queryClient.prefetchQuery(ratingsHistogramOptions(id)),
    queryClient.prefetchQuery(aiStatusOptions),
  ]);
  void queryClient.prefetchQuery(replyGuidelinesOptions(id));

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="@container/reviews page-wide flex flex-col gap-6">
        <Suspense fallback={<LedeSkeleton />}>
          <ReviewsLede id={id} />
        </Suspense>
        <div className={REVIEWS_GRID}>
          <div className={REVIEWS_MAIN}>
            <RatingsPanel id={id} />
            <ReviewsList id={id} />
          </div>
          <div className={REVIEWS_RAIL}>
            <RatingsDistribution id={id} />
            <Suspense fallback={null}>
              <RatingByVersion id={id} />
            </Suspense>
            <ReviewMentions id={id} />
          </div>
        </div>
      </div>
    </HydrationBoundary>
  );
}
