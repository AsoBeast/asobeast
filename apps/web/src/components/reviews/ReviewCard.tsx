"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { ReviewItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReplyStateBadge } from "./ReplyStateBadge";

const LOW_SCORE = 2;

function Stars({ score }: { score: number }) {
  const low = score <= LOW_SCORE;
  return (
    <span
      className={cn(
        "text-sm tracking-tight",
        low ? "text-destructive" : "text-foreground",
      )}
      role="img"
      aria-label={`${score} out of 5 stars`}
    >
      <span aria-hidden>
        {"★".repeat(score)}
        <span className="text-muted-foreground">{"☆".repeat(5 - score)}</span>
      </span>
    </span>
  );
}

function useOverflowing<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      setOverflowing(node.scrollHeight > node.clientHeight + 1);
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, overflowing] as const;
}

function ReviewText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [ref, overflowing] = useOverflowing<HTMLParagraphElement>();

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        ref={ref}
        className={cn(
          "text-body break-words whitespace-pre-line",
          expanded ? null : "line-clamp-4",
        )}
      >
        {text}
      </p>
      {expanded || overflowing ? (
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

function DeveloperReply({ review }: { review: ReviewItem }) {
  if (!review.replyText) return null;
  return (
    <div className="flex flex-col gap-1 border-l-2 border-border pl-3">
      <p className="text-caption text-muted-foreground">
        Developer reply
        {review.repliedAt ? ` · ${formatDate(review.repliedAt)}` : null}
      </p>
      <p className="text-body break-words whitespace-pre-line">
        {review.replyText}
      </p>
    </div>
  );
}

export function ReviewCard({
  review,
  actions,
  children,
}: {
  review: ReviewItem;
  actions?: ReactNode;
  children?: ReactNode;
}) {
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
        <span className="ml-auto">
          <ReplyStateBadge review={review} />
        </span>
      </div>
      {review.text.trim() ? (
        <ReviewText text={review.text} />
      ) : (
        <p className="text-body text-muted-foreground">No written review</p>
      )}
      <DeveloperReply review={review} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {review.userName ?? "Anonymous"} · {formatDate(review.reviewedAt)}
        </p>
        {actions}
      </div>
      {children}
    </article>
  );
}
