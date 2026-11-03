import { lowerCase, normalizeText, searchKey } from "@asobeast/shared";

export type KeywordSearch =
  | { kind: "none" }
  | { kind: "exact"; phrase: string }
  | { kind: "contains"; fragment: string };

const QUOTE_MARKS = new Set(['"', "“", "”", "„"]);

const isQuote = (character: string | undefined): boolean =>
  character !== undefined && QUOTE_MARKS.has(character);

const withoutQuotes = (text: string): string =>
  [...text].filter((character) => !isQuote(character)).join("");

const ACCENTED_LETTER = /([\p{Script=Latin}\p{Script=Greek}])\p{M}+/gu;

const foldAccents = (input: string): string =>
  lowerCase(input)
    .normalize("NFKD")
    .replace(ACCENTED_LETTER, "$1")
    .normalize("NFC");

export function parseKeywordSearch(raw: string): KeywordSearch {
  const trimmed = raw.trim();
  const inner = trimmed.slice(1, -1);
  const quoted =
    trimmed.length >= 2 &&
    isQuote(trimmed[0]) &&
    isQuote(trimmed[trimmed.length - 1]) &&
    withoutQuotes(inner) === inner;
  if (quoted) {
    const phrase = searchKey(normalizeText(inner));
    return phrase === "" ? { kind: "none" } : { kind: "exact", phrase };
  }
  const fragment = withoutQuotes(raw).toLowerCase();
  return fragment === "" ? { kind: "none" } : { kind: "contains", fragment };
}

export function matchesKeywordSearch(
  text: string,
  search: KeywordSearch,
): boolean {
  if (search.kind === "none") return true;
  if (search.kind === "exact")
    return searchKey(normalizeText(text)) === search.phrase;
  const foldedFragment = searchKey(normalizeText(search.fragment));
  return foldedFragment === ""
    ? text.toLowerCase().includes(search.fragment)
    : foldAccents(text).includes(foldAccents(search.fragment));
}
