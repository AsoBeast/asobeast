"use client";

import { Suspense, startTransition, useDeferredValue, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { storefrontLanguage, type ReviewSort } from "@asobeast/shared";
import {
  PANEL_ACTION,
  PANEL_BLEED,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoTip } from "@/components/ui/info-tip";
import { formatNumber } from "@/lib/format";
import { appDetailOptions, reviewsOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ReplyComposer } from "./ReplyComposer";
import { ReplyStateSwitch } from "./ReplyStateSwitch";
import { ReviewCard } from "./ReviewCard";
import { ReviewsToolbar } from "./ReviewsToolbar";
import { REPLY_STATES_GUIDE } from "./reply-state";
import {
  narrowsReviews,
  REVIEWS_SHOW_ALL_LIMIT,
  reviewFilters,
  type ReviewView,
} from "./review-filters";
import { matchesReviewQuery, quotedPhrase } from "./review-search";
import { reviewActionLabel, reviewTwins } from "./review-subject";
import { ReplySwitchSkeleton, ReviewsListSkeleton } from "./skeletons";
import { useReviewView } from "./use-review-view";

const SORT_WORDS: Record<ReviewSort, string> = {
  newest: "newest first",
  lowest: "lowest first",
};

const EMPTY_STATE = "px-4 py-12";

function searchCount(matches: number, shown: number, total: number): string {
  const found = `${formatNumber(matches)} of ${formatNumber(shown)} match the search`;
  return total > shown
    ? `${found} · search covers the ${formatNumber(shown)} loaded of ${formatNumber(total)} reviews`
    : found;
}

function ListFooter({
  shown,
  matches,
  total,
  sort,
  searching,
  expanded,
  onShowAll,
}: {
  shown: number;
  matches: number;
  total: number;
  sort: ReviewSort;
  searching: boolean;
  expanded: boolean;
  onShowAll: () => void;
}) {
  const partial = total > shown;
  const counted = searching
    ? searchCount(matches, shown, total)
    : `Showing ${formatNumber(shown)} of ${formatNumber(total)} · ${SORT_WORDS[sort]}`;
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border px-4 py-2.5 text-caption text-faint-foreground">
      <p role="status">{counted}</p>
      {partial && expanded ? (
        <p>
          {`The page shows at most ${REVIEWS_SHOW_ALL_LIMIT} reviews; narrow the filters to reach the others.`}
        </p>
      ) : null}
      {partial && !expanded ? (
        <Button variant="outline" size="sm" onClick={onShowAll}>
          Show all
        </Button>
      ) : null}
    </div>
  );
}

function ReviewCards({
  id,
  view,
  query,
  reply,
  onReply,
  onClearFilters,
  onResetSearch,
}: {
  id: string;
  view: ReviewView;
  query: string;
  reply: string | null;
  onReply: (reviewId: string | null) => void;
  onClearFilters: () => void;
  onResetSearch: () => void;
}) {
  const { data: app } = useSuspenseQuery(appDetailOptions(id));
  const viewKey = JSON.stringify(view);
  const [expandedView, setExpandedView] = useState<string | null>(null);
  const [closed, setClosed] = useState<string | null>(null);
  const searching = useDeferredValue(query.trim() !== "");
  const expanded = expandedView === viewKey || searching;
  const { data } = useSuspenseQuery(
    reviewsOptions(
      id,
      reviewFilters(view, expanded ? REVIEWS_SHOW_ALL_LIMIT : undefined),
    ),
  );

  const narrowed = narrowsReviews(view);
  const filtered = narrowed || view.replyState !== null;
  const queueCleared = view.replyState === "needs_reply" && !narrowed;

  if (data.total === 0) {
    return filtered ? (
      <EmptyState
        className={EMPTY_STATE}
        title={
          queueCleared
            ? "Nothing needs a reply"
            : "No reviews match these filters"
        }
        body={
          queueCleared
            ? "Every stored review has a reply or a saved draft."
            : "Nothing stored matches the selected rating, version, period and reply state."
        }
        action={
          <Button variant="outline" onClick={onClearFilters}>
            {queueCleared ? "Show all reviews" : "Clear filters"}
          </Button>
        }
      />
    ) : (
      <EmptyState
        className={EMPTY_STATE}
        title="No reviews stored yet"
        body="Reviews appear after the next daily sync."
      />
    );
  }

  const shown = data.reviews.filter((review) =>
    matchesReviewQuery(review, query),
  );
  const twins = reviewTwins(shown);

  return (
    <div className="flex flex-col">
      {shown.length === 0 ? (
        <EmptyState
          className={EMPTY_STATE}
          title="No reviews match this search"
          body={
            quotedPhrase(query) === null
              ? "Search looks through the titles, texts, authors and replies of the reviews loaded here."
              : "A search in quotes matches whole words in the titles and texts of the reviews loaded here."
          }
          action={
            <Button variant="outline" onClick={onResetSearch}>
              Reset search
            </Button>
          }
        />
      ) : (
        <div className="divide-y divide-border-subtle">
          {shown.map((review) => {
            const twin = twins.get(review.id);
            return (
              <ReviewCard
                key={review.id}
                appId={id}
                store={app.store}
                fallbackLanguage={storefrontLanguage(app.country)}
                review={review}
                twin={twin}
                open={reply === review.id}
                actions={
                  reply === review.id ? null : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      autoFocus={closed === review.id}
                      aria-label={reviewActionLabel(
                        review.reply?.text ? "Edit reply to" : "Reply to",
                        review,
                        twin,
                      )}
                      onClick={() => {
                        setClosed(null);
                        onReply(review.id);
                      }}
                    >
                      {review.reply?.text ? "Edit reply" : "Reply"}
                    </Button>
                  )
                }
              >
                {reply === review.id ? (
                  <ReplyComposer
                    appId={id}
                    review={review}
                    store={app.store}
                    storeAppId={app.storeAppId}
                    onClose={() => {
                      setClosed(review.id);
                      onReply(null);
                    }}
                  />
                ) : null}
              </ReviewCard>
            );
          })}
        </div>
      )}
      <ListFooter
        shown={data.reviews.length}
        matches={shown.length}
        total={data.total}
        sort={view.sort}
        searching={query.trim() !== ""}
        expanded={expanded}
        onShowAll={() => startTransition(() => setExpandedView(viewKey))}
      />
    </div>
  );
}

export function ReviewsList({ id }: { id: string }) {
  const {
    view,
    query,
    reply,
    setScore,
    setVersion,
    setSince,
    setReplyState,
    setSort,
    setQuery,
    setReply,
  } = useReviewView();

  return (
    <Card>
      <CardHeader
        className={`${PANEL_HEADER} flex flex-wrap items-center justify-between gap-x-4 gap-y-2`}
      >
        <CardTitle asChild>
          <h2>Reviews</h2>
        </CardTitle>
        <CardAction
          className={`${PANEL_ACTION} flex items-center gap-1 max-sm:w-full`}
        >
          <Suspense fallback={<ReplySwitchSkeleton />}>
            <ReplyStateSwitch
              id={id}
              view={view}
              onSelect={(next) => {
                void setReplyState(next);
                if (next === "needs_reply") void setSort("lowest");
              }}
            />
          </Suspense>
          <InfoTip
            label="About reply status"
            title="Reply status"
            summary="Needs reply: no reply anywhere. Draft: a reply is kept here and not marked. Replied: the store shows a reply, posted from here or in the console, or you marked the review as replied. Updated: the reviewer edited the review after the Google Play reply, so read it again."
          >
            <a
              href={REPLY_STATES_GUIDE}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground link-underline"
            >
              Read how replies work
            </a>
          </InfoTip>
        </CardAction>
      </CardHeader>
      <CardContent className={cn(PANEL_BLEED, "flex flex-col")}>
        <ReviewsToolbar
          id={id}
          view={view}
          query={query}
          onScore={(next) => void setScore(next)}
          onVersion={(next) => void setVersion(next || null)}
          onSince={(next) => void setSince(next)}
          onSort={(next) => void setSort(next === "newest" ? null : next)}
          onQuery={(next, options) => void setQuery(next || null, options)}
        />
        <Suspense fallback={<ReviewsListSkeleton />}>
          <ReviewCards
            id={id}
            view={view}
            query={query}
            reply={reply}
            onReply={(next) => void setReply(next)}
            onClearFilters={() => {
              void setScore(null);
              void setVersion(null);
              void setSince(null);
              void setReplyState(null);
              void setSort(null);
              void setQuery(null);
              void setReply(null);
            }}
            onResetSearch={() => {
              void setQuery(null);
              void setReply(null);
            }}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
