import type { SplitPhrase, WastedWord } from "@asobeast/shared";
import { formatList, formatNumber } from "@/lib/format";
import { localizationName } from "@/lib/localizations";

export const WASTE_LINE_LIMIT = 5;

const namesOf = (localizations: readonly string[]): string =>
  formatList(localizations.map(localizationName));

export function wastedWordLine({ word, localizations }: WastedWord): string {
  return `"${word}" is in ${namesOf(localizations)}.`;
}

export function splitPhraseLine({ phrase, parts }: SplitPhrase): string {
  const holders = parts
    .map(({ word, localizations }) => `${word} in ${namesOf(localizations)}`)
    .join(", ");
  return `"${phrase}": ${holders}.`;
}

export function limitedLines(
  lines: readonly string[],
  limit = WASTE_LINE_LIMIT,
): { shown: string[]; hidden: number } {
  return {
    shown: lines.slice(0, limit),
    hidden: Math.max(lines.length - limit, 0),
  };
}

export const moreLine = (hidden: number): string =>
  `and ${formatNumber(hidden)} more`;
