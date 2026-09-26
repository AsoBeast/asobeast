import type { AppSnapshotSummary, CompetitorItem } from "@asobeast/shared";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";

const COMPETITOR_CSV_HEADERS = [
  "competitor",
  "store",
  "title",
  "subtitle",
  "summary",
  "rating",
  "ratings",
  "installs",
  "price",
  "version",
  "capturedAt",
];

const SNAPSHOT_FIELDS = [
  "title",
  "subtitle",
  "summary",
  "ratingAvg",
  "ratingCount",
  "installs",
  "price",
  "version",
  "capturedAt",
] as const satisfies ReadonlyArray<keyof AppSnapshotSummary>;

export function competitorCsv(competitors: readonly CompetitorItem[]): string {
  return toCsv(
    COMPETITOR_CSV_HEADERS,
    competitors.map(({ name, store, latestSnapshot }) => [
      name,
      store,
      ...SNAPSHOT_FIELDS.map((field) => latestSnapshot?.[field] ?? null),
    ]),
  );
}

export function exportCompetitors(
  appId: string,
  competitors: readonly CompetitorItem[],
): void {
  downloadCsv(csvFilename("competitors", appId), competitorCsv(competitors));
}
