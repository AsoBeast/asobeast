import type { SerpEntryItem, SerpSnapshot } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";

type SerpRole = "you" | "competitor" | "other";

const SERP_CSV_HEADERS = [
  "keyword",
  "capturedOn",
  "position",
  "app",
  "developer",
  "rating",
  "ratings",
  "role",
  "storeAppId",
];

function roleOf(entry: SerpEntryItem, appId: string): SerpRole {
  if (entry.appId === appId) return "you";
  return entry.isCompetitor ? "competitor" : "other";
}

export function serpCsv(appId: string, snapshot: SerpSnapshot): string {
  return toCsv(
    SERP_CSV_HEADERS,
    snapshot.entries.map((entry) => [
      snapshot.text,
      snapshot.date,
      entry.position,
      entry.title,
      entry.developer,
      entry.ratingAvg,
      entry.ratingCount,
      roleOf(entry, appId),
      entry.storeAppId,
    ]),
  );
}

export function serpFilename(appId: string, snapshot: SerpSnapshot): string {
  return csvFilename(
    "serp",
    appId,
    snapshot.keywordId,
    snapshot.date ?? "latest",
  );
}

export function exportSerp(appId: string, snapshot: SerpSnapshot): void {
  downloadCsv(serpFilename(appId, snapshot), serpCsv(appId, snapshot));
}
