import type { Store } from "@asobeast/shared";
import type { LineWrap } from "../text-fit";

export const STORE_PREVIEW_DEVICES = ["small", "large"] as const;
export type StorePreviewDevice = (typeof STORE_PREVIEW_DEVICES)[number];

export const STORE_SURFACES = ["search", "product"] as const;
export type StoreSurface = (typeof STORE_SURFACES)[number];

export const MEASURED_FIELDS = [
  "title",
  "subtitle",
  "shortDescription",
] as const;
export type MeasuredField = (typeof MEASURED_FIELDS)[number];

export interface StoreTextLayout {
  fontFamily: string;
  fontPx: number;
  weight: number;
  letterSpacingPx: number;
  lineHeightPx: number;
  lines: number;
  wrap: LineWrap;
  widths: Record<StorePreviewDevice, number>;
}

export const STORE_FONT = {
  APP_STORE:
    '-apple-system, system-ui, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  GOOGLE_PLAY: 'Roboto, "Google Sans", Arial, sans-serif',
} as const satisfies Record<Store, string>;

export const STORE_SCREEN_WIDTHS = {
  APP_STORE: { small: 393, large: 430 },
  GOOGLE_PLAY: { small: 360, large: 412 },
} as const satisfies Record<Store, Record<StorePreviewDevice, number>>;

export const APP_STORE_COLUMN_INSETS = {
  search: 184,
  product: 174,
} as const satisfies Record<StoreSurface, number>;

const appStoreColumn = (
  surface: StoreSurface,
): Record<StorePreviewDevice, number> => ({
  small: STORE_SCREEN_WIDTHS.APP_STORE.small - APP_STORE_COLUMN_INSETS[surface],
  large: STORE_SCREEN_WIDTHS.APP_STORE.large - APP_STORE_COLUMN_INSETS[surface],
});

export const STORE_TEXT_LAYOUTS = {
  APP_STORE: {
    search: {
      title: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 15,
        weight: 600,
        letterSpacingPx: 0,
        lineHeightPx: 19,
        lines: 1,
        wrap: "words",
        widths: appStoreColumn("search"),
      },
      subtitle: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 12,
        weight: 400,
        letterSpacingPx: 0,
        lineHeightPx: 16,
        lines: 1,
        wrap: "none",
        widths: appStoreColumn("search"),
      },
    },
    product: {
      title: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 22,
        weight: 500,
        letterSpacingPx: -0.5,
        lineHeightPx: 28,
        lines: 2,
        wrap: "words",
        widths: appStoreColumn("product"),
      },
      subtitle: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 15,
        weight: 400,
        letterSpacingPx: -0.05,
        lineHeightPx: 20,
        lines: 1,
        wrap: "none",
        widths: appStoreColumn("product"),
      },
    },
  },
  GOOGLE_PLAY: {
    search: {
      title: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 16,
        weight: 500,
        letterSpacingPx: 0,
        lineHeightPx: 22,
        lines: 2,
        wrap: "words",
        widths: { small: 260, large: 300 },
      },
    },
    product: {
      title: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 22,
        weight: 500,
        letterSpacingPx: 0,
        lineHeightPx: 28,
        lines: 2,
        wrap: "words",
        widths: { small: 230, large: 270 },
      },
      shortDescription: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 14,
        weight: 400,
        letterSpacingPx: 0,
        lineHeightPx: 20,
        lines: 3,
        wrap: "words",
        widths: { small: 328, large: 368 },
      },
    },
  },
} as const satisfies Record<
  Store,
  Record<StoreSurface, Partial<Record<MeasuredField, StoreTextLayout>>>
>;

export const DEVICE_LABELS = {
  APP_STORE: { small: "6.1 inch", large: "6.7 inch" },
  GOOGLE_PLAY: { small: "Smaller phone", large: "Larger phone" },
} as const satisfies Record<Store, Record<StorePreviewDevice, string>>;

export function storeTextLayout(
  store: Store,
  surface: StoreSurface,
  field: MeasuredField,
): StoreTextLayout | null {
  const layouts: Partial<Record<MeasuredField, StoreTextLayout>> =
    STORE_TEXT_LAYOUTS[store][surface];
  return layouts[field] ?? null;
}

export const canvasFont = (layout: StoreTextLayout): string =>
  `${layout.weight} ${layout.fontPx}px ${layout.fontFamily}`;
