import { describe, expect, it } from "vitest";
import { STORES, type Store } from "@asobeast/shared";
import {
  canvasFont,
  STORE_PREVIEW_DEVICES,
  STORE_SCREEN_WIDTHS,
  STORE_SURFACES,
  storeTextLayout,
  type MeasuredField,
  type StoreTextLayout,
} from "./store-layouts";

const MEASURED_FIELDS: readonly MeasuredField[] = [
  "title",
  "subtitle",
  "shortDescription",
];

interface Row {
  name: string;
  store: Store;
  layout: StoreTextLayout;
}

const rows: Row[] = STORES.flatMap((store) =>
  STORE_SURFACES.flatMap((surface) =>
    MEASURED_FIELDS.flatMap((field): Row[] => {
      const layout = storeTextLayout(store, surface, field);
      return layout
        ? [{ name: `${store} ${surface} ${field}`, store, layout }]
        : [];
    }),
  ),
);

describe("STORE_TEXT_LAYOUTS", () => {
  it("names every store, surface and field the preview draws", () => {
    expect(rows.map(({ name }) => name)).toEqual([
      "APP_STORE search title",
      "APP_STORE search subtitle",
      "APP_STORE product title",
      "APP_STORE product subtitle",
      "GOOGLE_PLAY search title",
      "GOOGLE_PLAY product title",
      "GOOGLE_PLAY product shortDescription",
    ]);
    for (const { layout } of rows) {
      expect(Object.keys(layout.widths)).toEqual([...STORE_PREVIEW_DEVICES]);
    }
  });

  it("keeps the smaller device narrower", () => {
    for (const { layout } of rows) {
      expect(layout.widths.small).toBeLessThan(layout.widths.large);
    }
  });

  it("keeps every text column inside its screen", () => {
    for (const { store, layout } of rows) {
      for (const device of STORE_PREVIEW_DEVICES) {
        expect(layout.widths[device]).toBeLessThan(
          STORE_SCREEN_WIDTHS[store][device],
        );
      }
    }
  });

  it("draws at least one line and a line no shorter than its font", () => {
    for (const { layout } of rows) {
      expect(layout.lines).toBeGreaterThanOrEqual(1);
      expect(layout.lineHeightPx).toBeGreaterThanOrEqual(layout.fontPx);
    }
  });
});

describe("storeTextLayout", () => {
  it("answers the row of a measured field", () => {
    expect(storeTextLayout("APP_STORE", "search", "title")?.fontPx).toBe(17);
  });

  it("answers null for a field the surface does not draw", () => {
    expect(storeTextLayout("GOOGLE_PLAY", "search", "subtitle")).toBeNull();
    expect(
      storeTextLayout("APP_STORE", "product", "shortDescription"),
    ).toBeNull();
  });
});

describe("canvasFont", () => {
  it("writes the weight, size and family the canvas reads", () => {
    const layout = storeTextLayout("APP_STORE", "search", "title");
    expect(layout && canvasFont(layout)).toBe(
      '600 17px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    );
  });
});
