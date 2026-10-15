import {
  appRunTotals,
  type AppRunStage,
  type AppRunStatus,
} from "@asobeast/shared";
import { formatDateTime, formatNumber } from "@/lib/format";

export const RUN_PROGRESS_POLL_MS = 10_000;

export interface RunRow {
  stage: AppRunStage;
  label: string;
  ready: boolean;
  progress: string | null;
  detail: string;
}

const STAGE_COPY: Record<AppRunStage, { label: string; detail: string }> = {
  listings: {
    label: "Listings captured",
    detail: "Home and market listings of the app and its competitors.",
  },
  keywords: {
    label: "Positions checked",
    detail: "Positions of the active keywords.",
  },
  categories: {
    label: "Charts read",
    detail: "Category charts the app sits in.",
  },
};

const NOTHING_TO_COLLECT = "Nothing to collect.";

const countOf = (ready: number, total: number): string =>
  `${formatNumber(ready)} of ${formatNumber(total)}`;

const doneCount = (status: AppRunStatus): string => {
  const { ready, total } = appRunTotals(status);
  return countOf(ready, total);
};

export function pillText(status: AppRunStatus): string | null {
  switch (status.state) {
    case "running":
      return doneCount(status);
    case "complete":
      return "Run complete";
    case "delayed":
      return "Run delayed";
    case "idle":
      return null;
  }
}

export function pillLabel(status: AppRunStatus): string {
  switch (status.state) {
    case "complete":
      return "Today's run complete";
    case "delayed":
      return `Today's run delayed: ${doneCount(status)} checks done`;
    default:
      return `Today's run: ${doneCount(status)} checks done`;
  }
}

export function runRows(status: AppRunStatus): RunRow[] {
  return status.stages.map(({ stage, ready, total, complete }) => ({
    stage,
    label: STAGE_COPY[stage].label,
    ready: complete,
    progress: total > 1 ? countOf(ready, total) : null,
    detail: total === 0 ? NOTHING_TO_COLLECT : STAGE_COPY[stage].detail,
  }));
}

export function runProgressInterval(
  status: AppRunStatus | undefined,
): number | false {
  return status?.state === "running" ? RUN_PROGRESS_POLL_MS : false;
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

export const startedSentence = (status: AppRunStatus): string =>
  `Started ${formatDateTime(status.startedAt)}.`;
