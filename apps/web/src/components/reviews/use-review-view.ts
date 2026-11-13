"use client";

import { useQueryState } from "nuqs";
import {
  reviewQueryParser,
  reviewReplyParser,
  reviewReplyStateParser,
  reviewScoreParser,
  reviewSinceParser,
  reviewSortParser,
  reviewVersionParser,
} from "@/lib/search-params";
import type { ReviewView } from "./review-filters";

export function useReviewView() {
  const [score, setScore] = useQueryState("score", reviewScoreParser);
  const [version, setVersion] = useQueryState("version", reviewVersionParser);
  const [since, setSince] = useQueryState("since", reviewSinceParser);
  const [replyState, setReplyState] = useQueryState(
    "replyState",
    reviewReplyStateParser,
  );
  const [sort, setSort] = useQueryState("sort", reviewSortParser);
  const [query, setQuery] = useQueryState("q", reviewQueryParser);
  const [reply, setReply] = useQueryState("reply", reviewReplyParser);
  const view: ReviewView = { score, version, since, replyState, sort };

  return {
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
  };
}
