import {
  SERP_DEPTH,
  type SerpEntryItem,
  type SerpKeywordPlacement,
  type Store,
} from "@asobeast/shared";
import { SECOND_FIELD_NAMES, secondTextOf } from "./listing-line";
import type { SerpRole } from "./serp-csv";

export const PLACEMENT_LABELS: Record<SerpKeywordPlacement, string> = {
  title: "Title",
  subtitle: "Subtitle",
  both: "Title and subtitle",
  split: "Split across title and subtitle",
  none: "Neither",
};

const PLAY_PLACEMENT_LABELS: Record<SerpKeywordPlacement, string> = {
  title: "Title",
  subtitle: "Short description",
  both: "Title and short description",
  split: "Split across title and short description",
  none: "Neither",
};

const placementLabels = (store: Store) =>
  store === "GOOGLE_PLAY" ? PLAY_PLACEMENT_LABELS : PLACEMENT_LABELS;

export interface KeywordInLabel {
  label: string;
  note: string | null;
}

type Judged = Pick<
  SerpEntryItem,
  "placement" | "subtitle" | "shortDescription"
>;

export function keywordInLabel(entry: Judged, store: Store): KeywordInLabel {
  if (entry.placement) {
    return { label: placementLabels(store)[entry.placement], note: null };
  }
  return {
    label: "Not in the title",
    note:
      secondTextOf(entry, store) === undefined
        ? `${SECOND_FIELD_NAMES[store]} not known`
        : null,
  };
}

export const isOutlier = (
  entry: Judged & Pick<SerpEntryItem, "position">,
  role: SerpRole,
): boolean =>
  entry.placement === "none" &&
  entry.position <= SERP_DEPTH &&
  role === "competitor";
