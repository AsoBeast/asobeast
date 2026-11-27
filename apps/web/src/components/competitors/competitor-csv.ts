import type { AppSnapshotSummary, CompetitorItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enCompetitors from "../../../messages/en/competitors.json";
import type { MessageTranslator } from "@/i18n/translator";
import { csvFilename, downloadCsv, toCsv } from "@/lib/csv";

const english = createTranslator({
  locale: "en",
  namespace: "competitors",
  messages: { competitors: enCompetitors },
});

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

export function competitorCsv(
  competitors: readonly CompetitorItem[],
  t: MessageTranslator = english,
): string {
  return toCsv(
    [
      t("csv.competitor"),
      t("csv.store"),
      t("csv.title"),
      t("csv.subtitle"),
      t("csv.summary"),
      t("csv.rating"),
      t("csv.ratings"),
      t("csv.installs"),
      t("csv.price"),
      t("csv.version"),
      t("csv.capturedAt"),
    ],
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
  t: MessageTranslator = english,
): void {
  downloadCsv(csvFilename("competitors", appId), competitorCsv(competitors, t));
}
