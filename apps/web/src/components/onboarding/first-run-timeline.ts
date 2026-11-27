import type {
  FirstRunStage,
  FirstRunStageStatus,
  FirstRunStatus,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enSetup from "../../../messages/en/setup.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatRelativeTimeInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "setup",
  messages: { setup: enSetup },
});

export type FirstRunRowState = "ready" | "waiting";

export interface FirstRunRow {
  stage: FirstRunStage;
  label: string;
  state: FirstRunRowState;
  progress: string | null;
  detail: string;
}

function waitingDetail(
  row: FirstRunStageStatus,
  now: number,
  t: MessageTranslator,
  locale: Locale,
): string {
  const when = row.expectedBy
    ? formatRelativeTimeInLocale(row.expectedBy, now, locale)
    : null;

  switch (row.stage) {
    case "metadata":
      return t("timeline.metadataWaiting");
    case "keywords":
      return t("timeline.keywordsWaiting");
    case "rankings":
      return when
        ? t("timeline.rankingsWaiting", { when })
        : t("timeline.rankingsQueued", { queued: t("timeline.queued") });
    case "scores":
      return when
        ? t("timeline.scoresWaiting", { when })
        : t("timeline.scoresQueued", { queued: t("timeline.queued") });
    case "reviews":
      return t("timeline.reviewsWaiting");
    case "history":
      return t("timeline.historyWaiting");
  }
}

function detailOf(
  row: FirstRunStageStatus,
  now: number,
  t: MessageTranslator,
  locale: Locale,
): string {
  if (row.total === 0) return t(`timeline.${row.stage}None`);
  return row.complete
    ? t(`timeline.${row.stage}Ready`)
    : waitingDetail(row, now, t, locale);
}

export function firstRunRows(
  status: FirstRunStatus,
  now: number,
  t: MessageTranslator = english,
  locale: Locale = "en",
): FirstRunRow[] {
  return status.stages.map((row) => ({
    stage: row.stage,
    label: t(`timeline.${row.stage}Label`),
    state: row.complete ? "ready" : "waiting",
    progress:
      row.total > 1
        ? t("timeline.rowProgress", { ready: row.ready, total: row.total })
        : null,
    detail: detailOf(row, now, t, locale),
  }));
}

export function firstRunHeadline(
  status: FirstRunStatus,
  t: MessageTranslator = english,
): string {
  const waiting = status.stages.filter((row) => !row.complete).length;

  if (waiting === 0) return t("timeline.fullyCollected");
  return t("timeline.finishing", { count: waiting });
}

const listingWaiting = (status: FirstRunStatus): boolean =>
  status.stages.some((row) => row.stage === "metadata" && !row.complete);

export function listingSettled(
  previous: FirstRunStatus | undefined,
  next: FirstRunStatus | undefined,
): boolean {
  return (
    previous !== undefined &&
    next !== undefined &&
    listingWaiting(previous) &&
    !listingWaiting(next)
  );
}

const rankingsStage = (status: FirstRunStatus) =>
  status.stages.find((row) => row.stage === "rankings");

export const rankingsTracked = (status: FirstRunStatus): boolean =>
  (rankingsStage(status)?.total ?? 0) > 0;

export const rankingsCollecting = (status: FirstRunStatus | undefined) =>
  status ? rankingsStage(status)?.complete === false : false;

export function rankingsFinished(
  previous: FirstRunStatus | undefined,
  next: FirstRunStatus | undefined,
): boolean {
  return (
    rankingsCollecting(previous) &&
    next !== undefined &&
    !rankingsCollecting(next)
  );
}

export function rankingsAdvanced(
  previous: FirstRunStatus | undefined,
  next: FirstRunStatus | undefined,
): boolean {
  return (
    previous !== undefined &&
    next !== undefined &&
    (rankingsStage(next)?.ready ?? 0) > (rankingsStage(previous)?.ready ?? 0)
  );
}
