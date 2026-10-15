import type { SerpEntryItem, SerpSnapshot } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";

type SerpRole = "you" | "competitor" | "other";

export interface SerpViewer {
  appId: string;
  storeAppId: string | undefined;
}

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

export function serpRole(entry: SerpEntryItem, viewer: SerpViewer): SerpRole {
  if (entry.appId === viewer.appId || entry.storeAppId === viewer.storeAppId) {
    return "you";
  }
  return entry.isCompetitor ? "competitor" : "other";
}

export function serpCsv(viewer: SerpViewer, snapshot: SerpSnapshot): string {
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
      serpRole(entry, viewer),
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

export function exportSerp(viewer: SerpViewer, snapshot: SerpSnapshot): void {
  downloadCsv(serpFilename(viewer.appId, snapshot), serpCsv(viewer, snapshot));
}
