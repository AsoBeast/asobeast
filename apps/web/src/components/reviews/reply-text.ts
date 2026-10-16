import { countChars, REVIEW_REPLY_LIMITS, type Store } from "@asobeast/shared";

export interface ReplyMeasure {
  trimmed: string;
  length: number;
  limit: number;
  over: boolean;
}

export function measureReply(text: string, store: Store): ReplyMeasure {
  const trimmed = text.trim();
  const length = countChars(trimmed);
  const limit = REVIEW_REPLY_LIMITS[store];
  return { trimmed, length, limit, over: length > limit };
}
