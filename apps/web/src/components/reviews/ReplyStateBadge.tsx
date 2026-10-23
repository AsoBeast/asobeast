import { replyStateOf, type ReviewItem, type Store } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { replyBadgeLabel, replyStateVariant } from "./reply-state";

export function ReplyStateBadge({
  review,
  store,
}: {
  review: ReviewItem;
  store: Store;
}) {
  return (
    <Badge variant={replyStateVariant(replyStateOf(review))}>
      {replyBadgeLabel(review, store)}
    </Badge>
  );
}
