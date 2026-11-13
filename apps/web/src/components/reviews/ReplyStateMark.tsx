import type { ReviewItem, Store } from "@asobeast/shared";
import { cn } from "@/lib/utils";
import { replyBadgeLabel, replyBadgeVariant } from "./reply-state";

type ReplyTone = ReturnType<typeof replyBadgeVariant>;

const HALF = "border-[1.5px] bg-linear-to-r from-50% to-transparent to-50%";

const TONES: Record<ReplyTone, { text: string; mark: string }> = {
  outline: {
    text: "font-medium text-foreground",
    mark: "border-[1.5px] border-foreground",
  },
  secondary: {
    text: "text-muted-foreground",
    mark: `${HALF} border-muted-foreground from-muted-foreground`,
  },
  success: { text: "text-muted-foreground", mark: "bg-muted-foreground" },
  warning: {
    text: "font-medium text-warning",
    mark: `${HALF} border-warning from-warning`,
  },
  info: {
    text: "text-muted-foreground",
    mark: "border-[1.5px] border-dashed border-muted-foreground",
  },
};

export function ReplyStateMark({
  review,
  store,
  className,
}: {
  review: ReviewItem;
  store: Store;
  className?: string;
}) {
  const tone = TONES[replyBadgeVariant(review)];
  return (
    <span
      data-slot="reply-state"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 text-caption whitespace-nowrap",
        tone.text,
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", tone.mark)} />
      <span>{replyBadgeLabel(review, store)}</span>
    </span>
  );
}
