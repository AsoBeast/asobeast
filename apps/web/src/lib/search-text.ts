import { normalizeText } from "@asobeast/shared";

const EMOJI_RUN =
  /(?:[#*0-9]\u{FE0F}?\u{20E3}|[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}])[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u{E0020}-\u{E007F}\u{200D}\u{FE0F}]*/gu;

const withoutVariationSelectors = (value: string): string =>
  value.replaceAll("\u{FE0F}", "");

const emojiRuns = (value: string): string[] =>
  (value.match(EMOJI_RUN) ?? []).map(withoutVariationSelectors);

export function searchText(value: string): string {
  return normalizeText(value).normalize("NFD").replace(/\p{M}/gu, "");
}

export function hasSearchTerms(query: string): boolean {
  return searchText(query) !== "" || emojiRuns(query).length > 0;
}

export function containsEmoji(
  parts: readonly string[],
  query: string,
): boolean {
  const haystack = withoutVariationSelectors(parts.join(" "));
  return emojiRuns(query).every((run) => haystack.includes(run));
}

export function matchesSearch(
  parts: readonly string[],
  query: string,
): boolean {
  const needle = searchText(query);
  return (
    (needle === "" || searchText(parts.join(" ")).includes(needle)) &&
    containsEmoji(parts, query)
  );
}
