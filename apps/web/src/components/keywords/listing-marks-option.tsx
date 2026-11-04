import type { KeywordMarkSurface, Store } from "@asobeast/shared";
import type { ColumnVisibilityState, Updater } from "@tanstack/react-table";
import type { ViewOption } from "@/components/data-table/ColumnMenu";
import { MarkLegend } from "@/components/keyword-match/MatchedText";

const LISTING_MARKS = "listingMarks";

const LEGEND_SURFACES: Record<Store, readonly KeywordMarkSurface[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription"],
};

export function listingMarksOption(
  store: Store,
  visibility: ColumnVisibilityState,
  setVisibility: (updater: Updater<ColumnVisibilityState>) => void,
): ViewOption {
  return {
    id: LISTING_MARKS,
    label: "Listing marks",
    checked: visibility[LISTING_MARKS] !== false,
    onCheckedChange: (checked) =>
      setVisibility((current) => ({ ...current, [LISTING_MARKS]: checked })),
    description: <MarkLegend surfaces={LEGEND_SURFACES[store]} />,
  };
}
