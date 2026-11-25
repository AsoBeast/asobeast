import type { Store } from "@asobeast/shared";

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
  lineHeightPx: number;
  lines: number;
  widths: Record<StorePreviewDevice, number>;
}

export const STORE_FONT = {
  APP_STORE:
    '-apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
  GOOGLE_PLAY: 'Roboto, "Google Sans", Arial, sans-serif',
} as const satisfies Record<Store, string>;

export const STORE_SCREEN_WIDTHS = {
  APP_STORE: { small: 390, large: 430 },
  GOOGLE_PLAY: { small: 360, large: 412 },
} as const satisfies Record<Store, Record<StorePreviewDevice, number>>;

export const STORE_TEXT_LAYOUTS = {
  APP_STORE: {
    search: {
      title: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 17,
        weight: 600,
        lineHeightPx: 22,
        lines: 1,
        widths: { small: 188, large: 228 },
      },
      subtitle: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 13,
        weight: 400,
        lineHeightPx: 18,
        lines: 1,
        widths: { small: 188, large: 228 },
      },
    },
    product: {
      title: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 22,
        weight: 700,
        lineHeightPx: 28,
        lines: 2,
        widths: { small: 216, large: 256 },
      },
      subtitle: {
        fontFamily: STORE_FONT.APP_STORE,
        fontPx: 15,
        weight: 400,
        lineHeightPx: 20,
        lines: 1,
        widths: { small: 216, large: 256 },
      },
    },
  },
  GOOGLE_PLAY: {
    search: {
      title: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 16,
        weight: 500,
        lineHeightPx: 22,
        lines: 2,
        widths: { small: 260, large: 300 },
      },
    },
    product: {
      title: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 22,
        weight: 500,
        lineHeightPx: 28,
        lines: 2,
        widths: { small: 230, large: 270 },
      },
      shortDescription: {
        fontFamily: STORE_FONT.GOOGLE_PLAY,
        fontPx: 14,
        weight: 400,
        lineHeightPx: 20,
        lines: 3,
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
