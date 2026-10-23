import type {
  RatingsHistogram,
  RatingsHistory,
  ReviewList,
  ReviewReplyDraftRequest,
  ReviewReplyDraftResult,
  ReviewReplyGuidelines,
  ReviewReplyItem,
  ReviewReplyPatchRequest,
  ReviewReplyPostResult,
  ReviewReplyState,
  ReviewSort,
  ReviewThemes,
  ReviewTranslation,
  ReviewTranslationRequest,
} from "@asobeast/shared";
import { apiFetch, withQuery } from "./client";
import type { RangeParams } from "./client";

export interface ReviewFilters {
  score?: number;
  version?: string;
  from?: string;
  replyState?: ReviewReplyState;
  sort?: ReviewSort;
  limit?: number;
}

export type ReviewThemeFilters = Omit<ReviewFilters, "limit">;

function filterParams({
  score,
  version,
  from,
  replyState,
  sort,
}: ReviewThemeFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (score !== undefined) params.set("score", String(score));
  if (version) params.set("version", version);
  if (from) params.set("from", from);
  if (replyState) params.set("replyState", replyState);
  if (sort) params.set("sort", sort);
  return params;
}

export function getReviews(
  appId: string,
  { limit, ...filters }: ReviewFilters = {},
): Promise<ReviewList> {
  const params = filterParams(filters);
  if (limit !== undefined) params.set("limit", String(limit));
  return apiFetch<ReviewList>(withQuery(`/apps/${appId}/reviews`, params));
}

export function getReviewThemes(
  appId: string,
  filters: ReviewThemeFilters = {},
): Promise<ReviewThemes> {
  return apiFetch<ReviewThemes>(
    withQuery(`/apps/${appId}/reviews/themes`, filterParams(filters)),
  );
}

const replyPath = (appId: string, reviewId: string) =>
  `/apps/${appId}/reviews/${encodeURIComponent(reviewId)}/reply`;

export function patchReviewReply(
  appId: string,
  reviewId: string,
  body: ReviewReplyPatchRequest,
): Promise<ReviewReplyItem> {
  return apiFetch<ReviewReplyItem>(replyPath(appId, reviewId), {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteReviewReply(
  appId: string,
  reviewId: string,
): Promise<void> {
  return apiFetch<void>(replyPath(appId, reviewId), { method: "DELETE" });
}

export function postReviewReply(
  appId: string,
  reviewId: string,
): Promise<ReviewReplyPostResult> {
  return apiFetch<ReviewReplyPostResult>(`${replyPath(appId, reviewId)}/post`, {
    method: "POST",
  });
}

export function withdrawReviewReply(
  appId: string,
  reviewId: string,
): Promise<ReviewReplyPostResult> {
  return apiFetch<ReviewReplyPostResult>(`${replyPath(appId, reviewId)}/post`, {
    method: "DELETE",
  });
}

export function draftReviewReply(
  appId: string,
  reviewId: string,
  body: ReviewReplyDraftRequest,
): Promise<ReviewReplyDraftResult> {
  return apiFetch<ReviewReplyDraftResult>(
    `${replyPath(appId, reviewId)}/draft`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}

export function translateReview(
  appId: string,
  reviewId: string,
  body: ReviewTranslationRequest,
): Promise<ReviewTranslation> {
  return apiFetch<ReviewTranslation>(
    `/apps/${appId}/reviews/${encodeURIComponent(reviewId)}/translation`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function getReviewReplyGuidelines(
  appId: string,
): Promise<ReviewReplyGuidelines> {
  return apiFetch<ReviewReplyGuidelines>(
    `/apps/${appId}/reviews/reply-guidelines`,
  );
}

export function putReviewReplyGuidelines(
  appId: string,
  body: ReviewReplyGuidelines,
): Promise<ReviewReplyGuidelines> {
  return apiFetch<ReviewReplyGuidelines>(
    `/apps/${appId}/reviews/reply-guidelines`,
    { method: "PUT", body: JSON.stringify(body) },
  );
}

export function getRatingsHistogram(appId: string): Promise<RatingsHistogram> {
  return apiFetch<RatingsHistogram>(`/apps/${appId}/reviews/histogram`);
}

export function getRatingsHistory(
  appId: string,
  { from, to }: RangeParams = {},
): Promise<RatingsHistory> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return apiFetch<RatingsHistory>(
    withQuery(`/apps/${appId}/ratings-history`, params),
  );
}
