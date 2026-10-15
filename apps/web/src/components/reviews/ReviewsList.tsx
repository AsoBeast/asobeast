"use client";

import { Suspense, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatNumber } from "@/lib/format";
import { reviewsOptions } from "@/lib/queries";
import {
  reviewQueryParser,
  reviewReplyStateParser,
  reviewScoreParser,
  reviewSortParser,
  reviewVersionParser,
} from "@/lib/search-params";
import { ReviewCard } from "./ReviewCard";
import { ReviewCountsStrip } from "./ReviewCountsStrip";
import { ReviewsToolbar } from "./ReviewsToolbar";
import {
  REVIEWS_SHOW_ALL_LIMIT,
  reviewFilters,
  type ReviewView,
} from "./review-filters";
import { matchesReviewQuery } from "./review-search";
import { ReviewCountsSkeleton, ReviewsListSkeleton } from "./skeletons";

function ShowAll({
  shown,
  total,
  expanded,
  onShowAll,
}: {
  shown: number;
  total: number;
  expanded: boolean;
  onShowAll: () => void;
}) {
  if (total <= shown) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 pt-2">
      <p className="text-caption text-muted-foreground">
        Showing {formatNumber(shown)} of {formatNumber(total)}
      </p>
      {expanded ? (
        <p className="text-caption text-muted-foreground">
          The page shows at most {REVIEWS_SHOW_ALL_LIMIT} reviews; narrow the
          filters to reach the others.
        </p>
      ) : (
        <Button variant="outline" size="sm" onClick={onShowAll}>
          Show all
        </Button>
      )}
    </div>
  );
}

function ReviewCards({
  id,
  view,
  query,
  onClearFilters,
  onResetSearch,
}: {
  id: string;
  view: ReviewView;
  query: string;
  onClearFilters: () => void;
  onResetSearch: () => void;
}) {
  const viewKey = JSON.stringify(view);
  const [expandedView, setExpandedView] = useState<string | null>(null);
  const expanded = expandedView === viewKey;
  const { data } = useSuspenseQuery(
    reviewsOptions(
      id,
      reviewFilters(view, expanded ? REVIEWS_SHOW_ALL_LIMIT : undefined),
    ),
  );

  const filtered =
    view.score !== null || view.version !== "" || view.replyState !== null;

  if (data.total === 0) {
    return filtered ? (
      <EmptyState
        title="No reviews match these filters"
        body="Nothing stored matches the selected rating, version and reply state."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    ) : (
      <EmptyState
        title="No reviews stored yet"
        body="Reviews appear after the next daily sync."
      />
    );
  }

  const shown = data.reviews.filter((review) =>
    matchesReviewQuery(review, query),
  );

  return (
    <div className="flex flex-col">
      {shown.length === 0 ? (
        <EmptyState
          title="No reviews match this search"
          body="Search looks through the titles, texts, authors and replies of the reviews loaded here."
          action={
            <Button variant="outline" onClick={onResetSearch}>
              Reset search
            </Button>
          }
        />
      ) : (
        <div className="divide-y">
          {shown.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}
      <ShowAll
        shown={data.reviews.length}
        total={data.total}
        expanded={expanded}
        onShowAll={() => setExpandedView(viewKey)}
      />
    </div>
  );
}

export function ReviewsList({ id }: { id: string }) {
  const [score, setScore] = useQueryState("score", reviewScoreParser);
  const [version, setVersion] = useQueryState("version", reviewVersionParser);
  const [replyState, setReplyState] = useQueryState(
    "replyState",
    reviewReplyStateParser,
  );
  const [sort, setSort] = useQueryState("sort", reviewSortParser);
  const [query, setQuery] = useQueryState("q", reviewQueryParser);
  const view: ReviewView = { score, version, replyState, sort };

  return (
    <Card>
      <CardHeader>
        <CardDescription>Reviews</CardDescription>
        <CardTitle>User reviews</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Suspense fallback={<ReviewCountsSkeleton />}>
          <ReviewCountsStrip
            id={id}
            view={view}
            onSelect={(next) => void setReplyState(next)}
          />
        </Suspense>
        <ReviewsToolbar
          id={id}
          view={view}
          query={query}
          onScore={(next) => void setScore(next)}
          onVersion={(next) => void setVersion(next || null)}
          onReplyState={(next) => void setReplyState(next)}
          onSort={(next) => void setSort(next === "newest" ? null : next)}
          onQuery={(next, options) => void setQuery(next || null, options)}
        />
        <Suspense fallback={<ReviewsListSkeleton />}>
          <ReviewCards
            id={id}
            view={view}
            query={query}
            onClearFilters={() => {
              void setScore(null);
              void setVersion(null);
              void setReplyState(null);
              void setSort(null);
              void setQuery(null);
            }}
            onResetSearch={() => void setQuery(null)}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
