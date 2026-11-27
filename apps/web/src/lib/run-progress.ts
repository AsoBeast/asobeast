import {
  appRunTotals,
  type AppRunStage,
  type AppRunStatus,
} from "@asobeast/shared";
import { formatDateTimeInLocale } from "@/lib/format";
import type { MessageTranslator, TranslationContext } from "@/i18n/translator";

export const RUN_PROGRESS_POLL_MS = 10_000;

export interface RunRow {
  stage: AppRunStage;
  label: string;
  ready: boolean;
  progress: string | null;
  detail: string;
}

const countOf = (
  ready: number,
  total: number,
  translator: MessageTranslator,
): string => translator("progress.count", { ready, total });

const doneCount = (
  status: AppRunStatus,
  translator: MessageTranslator,
): string => {
  const { ready, total } = appRunTotals(status);
  return countOf(ready, total, translator);
};

const isPaused = (status: AppRunStatus): boolean =>
  status.paused === true && status.state !== "complete";

export function pillText(
  status: AppRunStatus,
  translator: MessageTranslator,
): string | null {
  if (isPaused(status)) return null;
  switch (status.state) {
    case "running":
      return translator("progress.running", {
        progress: doneCount(status, translator),
      });
    case "complete":
      return translator("progress.complete");
    case "delayed":
      return translator("progress.delayed");
    case "idle":
      return null;
  }
}

export function pillLabel(
  status: AppRunStatus,
  translator: MessageTranslator,
): string {
  switch (status.state) {
    case "complete":
      return translator("progress.labelComplete");
    case "delayed":
      return translator("progress.labelDelayed", {
        progress: doneCount(status, translator),
      });
    default:
      return translator("progress.labelRunning", {
        progress: doneCount(status, translator),
      });
  }
}

export function runRows(
  status: AppRunStatus,
  translator: MessageTranslator,
): RunRow[] {
  return status.stages.map(({ stage, ready, total, complete }) => ({
    stage,
    label: translator(`progress.stages.${stage}.label`),
    ready: complete,
    progress: total > 1 ? countOf(ready, total, translator) : null,
    detail:
      total === 0
        ? translator("progress.nothing")
        : translator(`progress.stages.${stage}.detail`),
  }));
}

export function runProgressInterval(
  status: AppRunStatus | undefined,
): number | false {
  return status && status.state === "running" && !isPaused(status)
    ? RUN_PROGRESS_POLL_MS
    : false;
}

export function runAdvanced(
  previous: AppRunStatus | undefined,
  next: AppRunStatus | undefined,
): boolean {
  if (!previous || !next) return false;
  return next.stages.some(
    (stage) =>
      stage.ready >
      (previous.stages.find((before) => before.stage === stage.stage)?.ready ??
        0),
  );
}

export const startedSentence = (
  status: AppRunStatus,
  context: TranslationContext,
): string =>
  context.translator("progress.started", {
    date: formatDateTimeInLocale(status.startedAt, context.locale),
  });
