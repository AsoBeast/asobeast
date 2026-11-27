import { createTranslator } from "next-intl";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import type { KeywordMarkSurface, Store } from "@asobeast/shared";
import type { ColumnVisibilityState, Updater } from "@tanstack/react-table";
import type { ViewOption } from "@/components/data-table/ColumnMenu";
import { MarkLegend } from "@/components/keyword-match/MatchedText";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

const LISTING_MARKS = "listingMarks";

const LEGEND_SURFACES: Record<Store, readonly KeywordMarkSurface[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription"],
};

export function listingMarksOption(
  store: Store,
  visibility: ColumnVisibilityState,
  setVisibility: (updater: Updater<ColumnVisibilityState>) => void,
  t: MessageTranslator = english,
): ViewOption {
  return {
    id: LISTING_MARKS,
    label: t("workspace.listingMarks"),
    checked: visibility[LISTING_MARKS] !== false,
    onCheckedChange: (checked) =>
      setVisibility((current) => ({ ...current, [LISTING_MARKS]: checked })),
    description: <MarkLegend surfaces={LEGEND_SURFACES[store]} />,
  };
}
