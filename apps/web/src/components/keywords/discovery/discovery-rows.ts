import { createTranslator } from "next-intl";
import {
  formatCheckedPosition,
  toDifficulty100,
  type DiscoveryState,
  type KeywordDiscoveryItem,
  type KeywordDiscoveryList,
} from "@asobeast/shared";
import enKeywordInspector from "../../../../messages/en/keywordInspector.json";
import type { MessageTranslator } from "@/i18n/translator";

const english = createTranslator({
  locale: "en",
  namespace: "keywordInspector",
  messages: { keywordInspector: enKeywordInspector },
});

export const DISCOVERY_PAGE_SIZE = 50;

export const rankText = (
  item: Pick<KeywordDiscoveryItem, "position" | "depth">,
): string | null => formatCheckedPosition(item.position, item.depth);

export function rankLabel(
  item: Pick<KeywordDiscoveryItem, "position" | "depth">,
  t: MessageTranslator = english,
): string {
  if (item.depth === null) return t("discovery.columns.notChecked");
  return item.position === null
    ? t("discovery.columns.notFound", { depth: item.depth })
    : t("discovery.columns.rank", { position: item.position });
}

export const shownScore = (value: number | null): number | null =>
  value === null ? null : Math.round(value);

export const shownDifficulty = (
  item: Pick<KeywordDiscoveryItem, "difficulty">,
): number | null =>
  item.difficulty === null
    ? null
    : shownScore(toDifficulty100(item.difficulty));

export type DiscoveryEmptyState =
  | { kind: "none" }
  | { kind: "never_run"; body: string }
  | { kind: "nothing_here"; title: string; body: string };

function nothingHere(
  state: DiscoveryState,
  t: MessageTranslator,
): { title: string; body: string } {
  return {
    title: t(`discovery.empty.nothing.${state}.title`),
    body: t(`discovery.empty.nothing.${state}.body`),
  };
}

function neverRunBody(
  { pending, nextRunAt }: KeywordDiscoveryList["checks"],
  t: MessageTranslator,
): string {
  if (pending > 0) return t("discovery.empty.neverRun.queued");
  return nextRunAt === null
    ? t("discovery.empty.neverRun.never")
    : t("discovery.empty.neverRun.weekly");
}

export function emptyStateOf(
  list: KeywordDiscoveryList,
  rows: number,
  state: DiscoveryState,
  t: MessageTranslator = english,
): DiscoveryEmptyState {
  if (rows > 0) return { kind: "none" };
  if (list.items.length === 0 && list.checks.checkedAt === null) {
    return { kind: "never_run", body: neverRunBody(list.checks, t) };
  }
  return { kind: "nothing_here", ...nothingHere(state, t) };
}
