import { replyStateOf, type ReviewItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { replyBadgeLabel, replyStateVariant } from "./reply-state";

export function ReplyStateBadge({ review }: { review: ReviewItem }) {
  return (
    <Badge variant={replyStateVariant(replyStateOf(review))}>
      {replyBadgeLabel(review)}
    </Badge>
  );
}
