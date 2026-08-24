"use client";

import { Suspense, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ReviewItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { reviewsOptions } from "@/lib/queries";
import { reviewScoreParser, reviewVersionParser } from "@/lib/search-params";
import { ReviewsListSkeleton } from "./skeletons";

const STAR_FILTERS = [5, 4, 3, 2, 1] as const;
const LOW_SCORE = 2;
const CLAMP_ABOVE = 240;

function Stars({ score }: { score: number }) {
  const low = score <= LOW_SCORE;
  return (
    <span
      className={cn(
        "text-sm tracking-tight",
        low ? "text-destructive" : "text-foreground",
      )}
      aria-label={`${score} out of 5 stars`}
    >
      <span aria-hidden>
        {"★".repeat(score)}
        <span className="text-muted-foreground">{"☆".repeat(5 - score)}</span>
      </span>
    </span>
  );
}

function ReviewText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={cn(
          "text-body break-words whitespace-pre-line",
          expanded ? null : "line-clamp-4",
        )}
      >
        {text}
      </p>
      {text.length > CLAMP_ABOVE ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="rounded-sm text-caption font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const low = review.score <= LOW_SCORE;
  return (
    <article
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 8rem" }}
      className={cn(
        "flex flex-col gap-2 border-l-2 py-3 pl-4",
        low ? "border-destructive/60" : "border-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Stars score={review.score} />
        {review.title ? (
          <span className="text-sm font-medium">{review.title}</span>
        ) : null}
        {review.version ? (
          <Badge variant="outline">v{review.version}</Badge>
        ) : null}
      </div>
      <ReviewText text={review.text} />
      <p className="text-xs text-muted-foreground">
        {review.userName ?? "Anonymous"} · {formatDate(review.reviewedAt)}
      </p>
    </article>
  );
}

function ReviewCards({
  id,
  score,
  version,
  onClearFilters,
}: {
  id: string;
  score: number | null;
  version: string;
  onClearFilters: () => void;
}) {
  const { data } = useSuspenseQuery(
    reviewsOptions(id, {
      score: score ?? undefined,
      version: version || undefined,
    }),
  );

  const filtered = score !== null || version !== "";

  if (data.total === 0) {
    return filtered ? (
      <EmptyState
        title="No reviews match these filters"
        body="Nothing stored matches the selected rating and version."
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

  return (
    <div className="divide-y">
      {data.reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  );
}

function VersionSelect({
  id,
  version,
  onChange,
}: {
  id: string;
  version: string;
  onChange: (next: string) => void;
}) {
  const { data } = useSuspenseQuery(reviewsOptions(id, {}));

  return (
    <Select
      value={version || "all"}
      onValueChange={(next) => onChange(next === "all" ? "" : next)}
    >
      <SelectTrigger className="w-[140px]" aria-label="Filter by version">
        <SelectValue placeholder="All versions" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All versions</SelectItem>
        {data.versions.map((item) => (
          <SelectItem key={item} value={item}>
            v{item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReviewsList({ id }: { id: string }) {
  const [score, setScore] = useQueryState("score", reviewScoreParser);
  const [version, setVersion] = useQueryState("version", reviewVersionParser);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <CardDescription>Reviews</CardDescription>
          <CardTitle>User reviews</CardTitle>
        </div>
        <Suspense fallback={null}>
          <VersionSelect id={id} version={version} onChange={setVersion} />
        </Suspense>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Filter by star rating"
        >
          {STAR_FILTERS.map((star) => (
            <Button
              key={star}
              size="sm"
              variant={score === star ? "default" : "outline"}
              aria-pressed={score === star}
              onClick={() => void setScore(score === star ? null : star)}
            >
              {star}
              <span aria-hidden>{"★"}</span>
            </Button>
          ))}
        </div>
        <Suspense fallback={<ReviewsListSkeleton />}>
          <ReviewCards
            id={id}
            score={score}
            version={version}
            onClearFilters={() => {
              void setScore(null);
              void setVersion(null);
            }}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
