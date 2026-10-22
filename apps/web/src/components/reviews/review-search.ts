import {
  listingSegments,
  normalizeText,
  type ReviewItem,
} from "@asobeast/shared";
import { containsEmoji, matchesSearch } from "@/lib/search-text";

const QUOTED = /^"(.*)"$/;

export function phraseQuery(phrase: string): string {
  return `"${phrase}"`;
}

export function quotedPhrase(query: string): string | null {
  const quoted = QUOTED.exec(query.trim());
  const phrase = quoted
    ? normalizeText(listingSegments(quoted[1]).join(" "))
    : "";
  return phrase === "" ? null : phrase;
}

function mentionsPhrase(review: ReviewItem, phrase: string): boolean {
  return [review.title ?? "", review.text].some((field) =>
    listingSegments(field).some((segment) =>
      ` ${normalizeText(segment)} `.includes(` ${phrase} `),
    ),
  );
}

export function matchesReviewQuery(review: ReviewItem, query: string): boolean {
  const phrase = quotedPhrase(query);
  if (phrase !== null) {
    return (
      mentionsPhrase(review, phrase) &&
      containsEmoji([review.title ?? "", review.text], query)
    );
  }
  return matchesSearch(
    [
      review.title ?? "",
      review.text,
      review.userName ?? "",
      review.replyText ?? "",
      review.reply?.text ?? "",
      review.translation?.title ?? "",
      review.translation?.text ?? "",
    ],
    query,
  );
}
