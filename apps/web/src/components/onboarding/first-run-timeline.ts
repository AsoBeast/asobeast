import type {
  FirstRunStage,
  FirstRunStageStatus,
  FirstRunStatus,
} from "@asobeast/shared";
import { formatRelativeTime } from "@/lib/format";

export type FirstRunRowState = "ready" | "waiting";

export interface FirstRunRow {
  stage: FirstRunStage;
  label: string;
  state: FirstRunRowState;
  progress: string | null;
  detail: string;
}

const LABELS: Record<FirstRunStage, string> = {
  metadata: "Listing captured",
  keywords: "Keywords tracked",
  rankings: "Positions collected",
  scores: "Traffic and difficulty scored",
  reviews: "Reviews backfilled",
  history: "Daily history",
};

const READY: Record<FirstRunStage, string> = {
  metadata: "The first listing snapshot is stored.",
  keywords: "Auto tracked from the indexed fields.",
  rankings: "Every tracked keyword has a position.",
  scores: "Traffic and difficulty are in for every tracked keyword.",
  reviews: "The review backfill is stored.",
  history: "A full week of daily captures is in.",
};

const NOTHING_EXPECTED: Record<FirstRunStage, string> = {
  metadata: "No listing snapshot is expected.",
  keywords: "No keywords are tracked for this app.",
  rankings: "No keywords are tracked, so there are no positions to collect.",
  scores: "No keywords are tracked, so there is nothing to score.",
  reviews: "This listing has no ratings, so there are no reviews to collect.",
  history: "No keywords are tracked, so no history is building.",
};

const QUEUED_WITHOUT_A_TIME =
  "Collection is queued rather than scheduled, so no time is promised.";

function waitingDetail(row: FirstRunStageStatus, now: number): string {
  const when = row.expectedBy ? formatRelativeTime(row.expectedBy, now) : null;

  switch (row.stage) {
    case "metadata":
      return "The first listing snapshot has not been captured yet.";
    case "keywords":
      return "Keywords are still being extracted from the listing.";
    case "rankings":
      return when
        ? `Positions are being collected now. The daily run catches anything still missing ${when}.`
        : `Positions are being collected now. ${QUEUED_WITHOUT_A_TIME}`;
    case "scores":
      return when
        ? `Every tracked keyword was queued for scoring at import. The weekly run catches anything still missing ${when}.`
        : `Every tracked keyword was queued for scoring at import. ${QUEUED_WITHOUT_A_TIME}`;
    case "reviews":
      return "The review backfill is running.";
    case "history":
      return "The trend rules need a week of daily captures before the action queue is worth reading.";
  }
}

function detailOf(row: FirstRunStageStatus, now: number): string {
  if (row.total === 0) {
    return NOTHING_EXPECTED[row.stage];
  }
  return row.complete ? READY[row.stage] : waitingDetail(row, now);
}

export function firstRunRows(
  status: FirstRunStatus,
  now: number = Date.now(),
): FirstRunRow[] {
  return status.stages.map((row) => ({
    stage: row.stage,
    label: LABELS[row.stage],
    state: row.complete ? "ready" : "waiting",
    progress: row.total > 1 ? `${row.ready} of ${row.total}` : null,
    detail: detailOf(row, now),
  }));
}

export function firstRunHeadline(status: FirstRunStatus): string {
  const waiting = status.stages.filter((row) => !row.complete).length;

  if (waiting === 0) {
    return "This app is fully collected.";
  }
  return waiting === 1
    ? "One step is still finishing."
    : `${waiting} steps are still finishing.`;
}
