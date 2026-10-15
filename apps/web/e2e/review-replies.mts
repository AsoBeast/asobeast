import {
  countChars,
  countMaxLengthChars,
  REVIEW_REPLY_GUIDELINES_MAX,
  REVIEW_REPLY_LIMITS,
  replyStateOf,
  type ReviewItem,
  type ReviewList,
  type ReviewReplyDraftRequest,
  type ReviewReplyDraftResult,
  type ReviewReplyItem,
  type ReviewReplyPatchRequest,
  type ReviewReplyState,
  type ReviewTranslation,
  type Store,
  UNKNOWN_LANGUAGE,
} from "@asobeast/shared";

const DEFAULT_LIMIT = 50;

const replies = new Map<string, ReviewReplyItem | null>();
const guidelines = new Map<string, string>();
const translations = new Map<string, ReviewTranslation>();

const keyOf = (appId: string, reviewId: string) => `${appId}:${reviewId}`;

const storeLabel = (store: Store) =>
  store === "GOOGLE_PLAY" ? "Google Play" : "App Store";

export class ReplyRefusal extends Error {}

function withReply(appId: string, review: ReviewItem): ReviewItem {
  const key = keyOf(appId, review.id);
  const translation = translations.get(key);
  return {
    ...review,
    ...(replies.has(key) ? { reply: replies.get(key) } : {}),
    ...(translation ? { translation } : {}),
  };
}

const byLowest = (a: ReviewItem, b: ReviewItem) =>
  a.score - b.score || (b.reviewedAt ?? "").localeCompare(a.reviewedAt ?? "");

export function listReviews(
  appId: string,
  list: ReviewList,
  query: URLSearchParams,
): ReviewList {
  const score = query.get("score");
  const version = query.get("version");
  const from = query.get("from");
  const state = query.get("replyState") as ReviewReplyState | null;
  const limit = Number(query.get("limit") ?? DEFAULT_LIMIT);
  const matching = list.reviews
    .map((review) => withReply(appId, review))
    .filter(
      (review) =>
        (!score || review.score === Number(score)) &&
        (!version || review.version === version) &&
        (!from || (review.reviewedAt ?? "") >= from),
    );
  const countOf = (target: ReviewReplyState) =>
    matching.filter((review) => replyStateOf(review) === target).length;
  const listed = matching.filter(
    (review) => !state || replyStateOf(review) === state,
  );
  const sorted =
    query.get("sort") === "lowest" ? [...listed].sort(byLowest) : listed;
  return {
    reviews: sorted.slice(0, limit),
    total: listed.length,
    versions: list.versions,
    counts: {
      needsReply: countOf("needs_reply"),
      drafted: countOf("drafted"),
      replied: countOf("replied"),
      updated: countOf("updated"),
    },
  };
}

export function findReview(
  appId: string,
  list: ReviewList,
  reviewId: string,
): ReviewItem | undefined {
  const review = list.reviews.find((candidate) => candidate.id === reviewId);
  return review && withReply(appId, review);
}

export function patchReply(
  appId: string,
  store: Store,
  review: ReviewItem,
  body: ReviewReplyPatchRequest,
): ReviewReplyItem {
  const text = body.text?.trim();
  if (text !== undefined) {
    if (text === "" && body.replied !== true) {
      throw new ReplyRefusal("A reply needs some text");
    }
    const limit = REVIEW_REPLY_LIMITS[store];
    if (countChars(text) > limit) {
      throw new ReplyRefusal(
        `A ${storeLabel(store)} reply is at most ${limit} characters`,
      );
    }
  }
  const current = review.reply ?? null;
  const now = new Date().toISOString();
  const next: ReviewReplyItem = {
    text: text ?? current?.text ?? "",
    tone: current?.tone ?? null,
    model: current?.model ?? null,
    generatedAt: current?.generatedAt ?? null,
    updatedAt: now,
    repliedAt:
      body.replied === undefined
        ? (current?.repliedAt ?? null)
        : body.replied
          ? now
          : null,
  };
  const removed = body.replied === false && next.text === "";
  replies.set(keyOf(appId, review.id), removed ? null : next);
  return next;
}

export function discardReply(appId: string, reviewId: string): void {
  replies.set(keyOf(appId, reviewId), null);
}

export function draftReply(
  appId: string,
  review: ReviewItem,
  body: ReviewReplyDraftRequest,
  draft: { text: string; language: string },
  options: { model: string; truncated: boolean },
): ReviewReplyDraftResult {
  const now = new Date().toISOString();
  const text = options.truncated
    ? draft.text.split(/(?<=[.!?])\s/)[0]
    : draft.text;
  const reply: ReviewReplyItem = {
    text,
    tone: body.tone ?? "neutral",
    model: options.model,
    generatedAt: now,
    updatedAt: now,
    repliedAt: review.reply?.repliedAt ?? null,
  };
  replies.set(keyOf(appId, review.id), reply);
  return { reply, language: draft.language, truncated: options.truncated };
}

export function translateReviewIn(
  appId: string,
  review: ReviewItem,
  language: string,
  translated: { title: string | null; text: string },
): ReviewTranslation {
  const translation: ReviewTranslation = {
    language,
    sourceLanguage: review.language ?? UNKNOWN_LANGUAGE,
    ...translated,
    translatedAt: new Date().toISOString(),
  };
  translations.set(keyOf(appId, review.id), translation);
  return translation;
}

export function guidelinesOf(appId: string): string {
  return guidelines.get(appId) ?? "";
}

export function setGuidelines(appId: string, text: string): string {
  if (countMaxLengthChars(text) > REVIEW_REPLY_GUIDELINES_MAX) {
    throw new ReplyRefusal(
      `guidelines must be shorter than or equal to ${REVIEW_REPLY_GUIDELINES_MAX} characters`,
    );
  }
  const trimmed = text.trim();
  guidelines.set(appId, trimmed);
  return trimmed;
}

export function resetReviewReplies(appId: string): void {
  for (const key of replies.keys()) {
    if (key.startsWith(`${appId}:`)) replies.delete(key);
  }
  for (const key of translations.keys()) {
    if (key.startsWith(`${appId}:`)) translations.delete(key);
  }
  guidelines.delete(appId);
}
