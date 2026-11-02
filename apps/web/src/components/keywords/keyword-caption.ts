import { formatList } from "@/lib/format";

export interface KeywordCaptionColumns {
  added: boolean;
  playInstalls: boolean;
  competitors: boolean;
}

export function keywordTableCaption(columns: KeywordCaptionColumns): string {
  const phrases = [
    "source",
    columns.added ? "date added" : null,
    "position and its daily change",
    "popularity",
    "difficulty",
    "opportunity",
    columns.playInstalls ? "Play installs per search term" : null,
    "7 day change",
    "top 10 volatility",
    columns.competitors ? "competitors in the top 10" : null,
  ].filter((phrase) => phrase !== null);
  return `Tracked keywords with ${formatList(phrases)}.`;
}
