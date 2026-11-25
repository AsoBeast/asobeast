import type { Store } from "@asobeast/shared";
import { fitLines, type LineFit } from "../text-fit";
import type { FontMeasure } from "./canvas-measure";
import type { PreviewListing } from "./preview-listing";
import {
  canvasFont,
  MEASURED_FIELDS,
  storeTextLayout,
  type MeasuredField,
  type StorePreviewDevice,
  type StoreSurface,
  type StoreTextLayout,
} from "./store-layouts";

export interface CutSentence {
  lead: string;
  words: string;
  rest: string;
}

export interface FieldCut extends CutSentence {
  field: MeasuredField;
}

const QUOTED_WORDS = 2;

const FIELD_LEADS: Record<MeasuredField, string> = {
  title: "Cut after “",
  subtitle: "Subtitle cut after “",
  shortDescription: "Short description cut after “",
};

const WHERE: Record<Store, Record<StorePreviewDevice | "every", string>> = {
  APP_STORE: {
    small: "smaller iPhones",
    large: "larger iPhones",
    every: "every iPhone",
  },
  GOOGLE_PLAY: {
    small: "smaller phones",
    large: "larger phones",
    every: "every phone",
  },
};

const lastWords = (fit: LineFit): string =>
  (fit.cutWord === "" ? fit.shownWords : [...fit.shownWords, `${fit.cutWord}…`])
    .slice(-QUOTED_WORDS)
    .join(" ");

export function cutSentence({
  field,
  store,
  device,
  small,
  large,
}: {
  field: MeasuredField;
  store: Store;
  device: StorePreviewDevice;
  small: LineFit;
  large: LineFit;
}): CutSentence | null {
  const shown = device === "small" ? small : large;
  const words = lastWords(shown);
  if (!shown.cut || words === "") return null;
  const every = small.cut && large.cut && small.cutAt === large.cutAt;
  return {
    lead: FIELD_LEADS[field],
    words,
    rest: `” on ${WHERE[store][every ? "every" : device]}. Words after the cut still count for search.`,
  };
}

export const fitStoreText = (
  text: string,
  layout: StoreTextLayout,
  device: StorePreviewDevice,
  measure: FontMeasure,
): LineFit =>
  fitLines(
    text,
    { width: layout.widths[device], lines: layout.lines },
    measure(canvasFont(layout)),
  );

const measuredText = (
  listing: PreviewListing,
  field: MeasuredField,
): string | null => (field === "title" ? listing.title : listing[field]);

export function cutSentences(
  listing: PreviewListing,
  surface: StoreSurface,
  device: StorePreviewDevice,
  measure: FontMeasure,
): FieldCut[] {
  return MEASURED_FIELDS.flatMap((field): FieldCut[] => {
    const layout = storeTextLayout(listing.store, surface, field);
    const text = measuredText(listing, field);
    if (!layout || !text) return [];
    const sentence = cutSentence({
      field,
      store: listing.store,
      device,
      small: fitStoreText(text, layout, "small", measure),
      large: fitStoreText(text, layout, "large", measure),
    });
    return sentence ? [{ field, ...sentence }] : [];
  });
}
