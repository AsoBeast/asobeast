import {
  formatCheckedPosition,
  toDifficulty100,
  type DiscoveryState,
  type KeywordDiscoveryItem,
  type KeywordDiscoveryList,
} from "@asobeast/shared";
import { grade, type Grade, type GradeMetric } from "@/lib/grade";

export const DISCOVERY_PAGE_SIZE = 50;

export const rankText = (
  item: Pick<KeywordDiscoveryItem, "position" | "depth">,
): string | null => formatCheckedPosition(item.position, item.depth);

export function rankLabel(
  item: Pick<KeywordDiscoveryItem, "position" | "depth">,
): string {
  if (item.depth === null) return "Not checked yet";
  return item.position === null
    ? `Not found in the top ${item.depth}`
    : `Rank ${item.position}`;
}

export interface DiscoveryScore {
  value: number | null;
  grade: Grade | null;
}

const scored = (metric: GradeMetric, value: number | null): DiscoveryScore => {
  const shown = value === null ? null : Math.round(value);
  return { value: shown, grade: grade(metric, shown) };
};

export const popularityScore = (item: KeywordDiscoveryItem): DiscoveryScore =>
  scored("popularity", item.volume);

export const difficultyScore = (item: KeywordDiscoveryItem): DiscoveryScore =>
  scored(
    "difficulty",
    item.difficulty === null ? null : toDifficulty100(item.difficulty),
  );

export const relevanceScore = (item: KeywordDiscoveryItem): DiscoveryScore =>
  scored("relevance", item.relevance);

export const opportunityScore = (item: KeywordDiscoveryItem): DiscoveryScore =>
  scored("opportunity", item.opportunity);

export type DiscoveryEmptyState =
  | { kind: "none" }
  | { kind: "never_run"; body: string }
  | { kind: "nothing_here"; title: string; body: string };

const NOTHING_HERE: Record<DiscoveryState, { title: string; body: string }> = {
  all: {
    title: "Nothing to review",
    body: "Every keyword found near your listing is tracked or dismissed. New ones appear after the next weekly run.",
  },
  ranked: {
    title: "Nothing ranked yet",
    body: "None of these keywords show your app in the store search yet. Checked keywords move here when your app appears.",
  },
  opportunity: {
    title: "No opportunities yet",
    body: "Opportunities need a popularity and a difficulty score. Track a keyword to score it, or wait for the next scoring run.",
  },
};

function neverRunBody({
  pending,
  nextRunAt,
}: KeywordDiscoveryList["checks"]): string {
  if (pending > 0) {
    return "AsoBeast has queued checks of the keywords near your listing. Any it finds in this market appear here.";
  }
  return nextRunAt === null
    ? "AsoBeast has not looked for keywords near your listing yet. Press Refresh to look now."
    : "AsoBeast looks for keywords near your listing once a week. Press Refresh to look now.";
}

export function emptyStateOf(
  list: KeywordDiscoveryList,
  rows: number,
  state: DiscoveryState,
): DiscoveryEmptyState {
  if (rows > 0) return { kind: "none" };
  if (list.items.length === 0 && list.checks.checkedAt === null) {
    return { kind: "never_run", body: neverRunBody(list.checks) };
  }
  return { kind: "nothing_here", ...NOTHING_HERE[state] };
}
