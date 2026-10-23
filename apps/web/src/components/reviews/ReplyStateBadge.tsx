import type { ReviewItem, Store } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { replyBadgeLabel, replyBadgeVariant } from "./reply-state";

export function ReplyStateBadge({
  review,
  store,
}: {
  review: ReviewItem;
  store: Store;
}) {
  return (
    <Badge variant={replyBadgeVariant(review)}>
      {replyBadgeLabel(review, store)}
    </Badge>
  );
}
