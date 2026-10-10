import { normalizeText } from "@asobeast/shared";

export interface HighlightPart {
  text: string;
  match: boolean;
}

const WORD = /([\p{L}\p{M}\p{N}]+)/u;

export function highlightTerms(
  value: string,
  terms: readonly string[],
): HighlightPart[] {
  const wanted = new Set(terms);
  return value
    .split(WORD)
    .filter((part) => part.length > 0)
    .map((part) => ({ text: part, match: wanted.has(normalizeText(part)) }));
}

export type MatchStrength = "phrase" | "partial" | "none";

export function matchStrength(field: {
  phrase: boolean;
  terms: readonly string[];
}): MatchStrength {
  if (field.phrase) return "phrase";
  return field.terms.length > 0 ? "partial" : "none";
}

export function matchLabel(
  field: { phrase: boolean; terms: readonly string[] },
  total: number,
): string {
  const strength = matchStrength(field);
  if (strength === "phrase") {
    return total > 1 ? "Exact phrase" : "Match";
  }
  if (strength === "none") return "No match";
  return `${field.terms.length} of ${total} words`;
}
