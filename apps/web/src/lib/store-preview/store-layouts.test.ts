import { describe, expect, it } from "vitest";
import { STORES, type Store } from "@asobeast/shared";
import {
  APP_STORE_COLUMN_INSETS,
  canvasFont,
  MEASURED_FIELDS,
  STORE_PREVIEW_DEVICES,
  STORE_SCREEN_WIDTHS,
  STORE_SURFACES,
  storeTextLayout,
  type StoreTextLayout,
} from "./store-layouts";

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

describe("App Store layout from the App Store Connect device preview", () => {
  const app = (surface: "search" | "product", field: "title" | "subtitle") =>
    storeTextLayout("APP_STORE", surface, field);

  it("draws the 6.1 inch frame at the preview's 393 point iPhone", () => {
    expect(STORE_SCREEN_WIDTHS.APP_STORE).toEqual({ small: 393, large: 430 });
  });

  it("keeps the search result column between the icon and the Get button", () => {
    expect(app("search", "title")?.widths).toEqual({ small: 209, large: 246 });
    expect(app("search", "subtitle")?.widths).toEqual({
      small: 209,
      large: 246,
    });
    expect(APP_STORE_COLUMN_INSETS.search).toBe(20 + 60 + 12 + 72 + 20);
  });

  it("keeps the product page column beside the icon", () => {
    expect(app("product", "title")?.widths).toEqual({ small: 219, large: 256 });
    expect(app("product", "subtitle")?.widths).toEqual({
      small: 219,
      large: 256,
    });
  });

  it("sets the type the preview draws", () => {
    expect(
      [
        app("search", "title"),
        app("search", "subtitle"),
        app("product", "title"),
        app("product", "subtitle"),
      ].map((layout) =>
        layout
          ? [layout.fontPx, layout.weight, layout.letterSpacingPx, layout.lines]
          : null,
      ),
    ).toEqual([
      [15, 600, 0, 1],
      [12, 400, 0, 1],
      [22, 500, -0.5, 2],
      [15, 400, -0.05, 1],
    ]);
  });
});

describe("storeTextLayout", () => {
  it("answers the row of a measured field", () => {
    expect(storeTextLayout("APP_STORE", "search", "title")?.fontPx).toBe(15);
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
      '600 15px -apple-system, system-ui, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    );
  });
});
