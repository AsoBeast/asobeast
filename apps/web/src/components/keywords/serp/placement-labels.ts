import {
  SERP_DEPTH,
  type SerpEntryItem,
  type SerpKeywordPlacement,
  type Store,
} from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";
import type { SerpRole } from "./serp-csv";

export const PLACEMENT_LABELS: Record<SerpKeywordPlacement, string> = {
  title: "Title",
  subtitle: "Subtitle",
  both: "Title and subtitle",
  split: "Split across title and subtitle",
  none: "Neither",
};

export interface KeywordInLabel {
  label: string;
  note: string | null;
}

type Judged = Pick<SerpEntryItem, "placement" | "subtitle">;

export function keywordInLabel(
  entry: Judged,
  store: Store,
  t?: MessageTranslator,
): KeywordInLabel {
  if (entry.placement) {
    return { label: PLACEMENT_LABELS[entry.placement], note: null };
  }
  const unknown = store === "APP_STORE" && entry.subtitle === undefined;
  return {
    label: t ? t("serp.row.notInTitle") : "Not in the title",
    note: unknown
      ? t
        ? t("serp.row.subtitleNotKnown")
        : "subtitle not known"
      : null,
  };
}

export const isOutlier = (
  entry: Judged & Pick<SerpEntryItem, "position">,
  store: Store,
  role: SerpRole,
): boolean =>
  entry.placement === "none" &&
  entry.position <= SERP_DEPTH &&
  store === "APP_STORE" &&
  role === "competitor";
