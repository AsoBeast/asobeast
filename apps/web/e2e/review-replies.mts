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
  type ReviewReplyPostResult,
  type ReviewReplyState,
  type ReviewTranslation,
  type Store,
  UNKNOWN_LANGUAGE,
} from "@asobeast/shared";

const DEFAULT_LIMIT = 50;

const replies = new Map<string, ReviewReplyItem | null>();
const guidelines = new Map<string, string>();
const translations = new Map<string, ReviewTranslation>();
const storeSides = new Map<
  string,
  Pick<ReviewItem, "repliedAt" | "replyText">
>();

export const REPLY_POST_COOKIE = "e2e_reply_post";
export const REPLY_POSTER = "owner@example.com";
export const PLAY_NO_WITHDRAW =
  "Google Play offers no way to remove a reply through its API. Edit or remove it in Play Console.";

const POST_FAILURES: Record<string, { status: number; message: string }> = {
  forbidden: {
    status: 403,
    message:
      "This App Store Connect key cannot respond to reviews. Connect a key with the Admin or Customer Support role.",
  },
  refused: {
    status: 422,
    message:
      "App Store Connect refused the reply: This review already has a response.",
  },
  missing: {
    status: 404,
    message:
      "This review was not found in App Store Connect. Apple's feed and App Store Connect can disagree for a few days.",
  },
  unreachable: {
    status: 502,
    message: "App Store Connect did not answer: connection refused",
  },
  ratelimited: {
    status: 429,
    message: "App Store Connect asked to slow down. Try again in 1 minute.",
  },
};

const keyOf = (appId: string, reviewId: string) => `${appId}:${reviewId}`;

const storeLabel = (store: Store) =>
  store === "GOOGLE_PLAY" ? "Google Play" : "App Store";

export class ReplyRefusal extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function withReply(appId: string, review: ReviewItem): ReviewItem {
  const key = keyOf(appId, review.id);
  const translation = translations.get(key);
  return {
    ...review,
    ...storeSides.get(key),
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
    post: current?.post ?? null,
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

export function postReply(
  appId: string,
  store: Store,
  review: ReviewItem,
  failure: string | undefined,
): ReviewReplyPostResult {
  const refused = failure ? POST_FAILURES[failure] : undefined;
  if (refused) throw new ReplyRefusal(refused.message, refused.status);
  const text = review.reply?.text.trim();
  if (!review.reply || !text) {
    throw new ReplyRefusal("Save a reply before posting it.");
  }
  const now = new Date().toISOString();
  const key = keyOf(appId, review.id);
  replies.set(key, {
    ...review.reply,
    repliedAt: now,
    post: {
      postedAt: now,
      postedText: text,
      state: store === "APP_STORE" ? "pending" : "published",
      storeResponseId: store === "APP_STORE" ? "response-1" : null,
      postedBy: REPLY_POSTER,
    },
  });
  storeSides.set(key, { repliedAt: now, replyText: text });
  return { review: withReply(appId, review) };
}

export function withdrawReply(
  appId: string,
  store: Store,
  review: ReviewItem,
): ReviewReplyPostResult {
  if (store === "GOOGLE_PLAY") throw new ReplyRefusal(PLAY_NO_WITHDRAW, 409);
  if (!review.reply?.post) {
    throw new ReplyRefusal("This reply has not been posted to the store.", 404);
  }
  const key = keyOf(appId, review.id);
  replies.set(key, { ...review.reply, repliedAt: null, post: null });
  storeSides.set(key, { repliedAt: null, replyText: null });
  return { review: withReply(appId, review) };
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
  for (const map of [translations, storeSides]) {
    for (const key of map.keys()) {
      if (key.startsWith(`${appId}:`)) map.delete(key);
    }
  }
  guidelines.delete(appId);
}
