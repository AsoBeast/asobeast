import { describe, expect, it } from "vitest";
import type { ChartEntryItem, ChartPage } from "@asobeast/shared";
import {
  capturableToday,
  categoryDates,
  CHART_COLUMN_ROWS,
  columnCaption,
  columnRows,
} from "./chart-column-rows";

const entry = (position: number): ChartEntryItem => ({
  position,
  storeAppId: String(position),
  title: `App ${position}`,
  developer: null,
  iconUrl: null,
  genreId: null,
  genreName: null,
  free: true,
  previous: null,
  delta: null,
  movement: "new",
});

const entries = (count: number) =>
  Array.from({ length: count }, (_, index) => entry(index + 1));

type Captioned = Pick<ChartPage, "capture" | "dates" | "entries" | "today">;

const CAPTURED: Captioned = {
  capture: {
    date: "2026-10-14",
    depth: 100,
    capturedAt: "2026-10-14T03:00:00.000Z",
  },
  dates: ["2026-10-14", "2026-10-13"],
  entries: entries(100),
  today: "2026-10-15",
};

describe("columnRows", () => {
  it("keeps the first rows by position", () => {
    const rows = columnRows({ entries: entries(100).reverse() });

    expect(rows).toHaveLength(CHART_COLUMN_ROWS);
    expect(rows[0].position).toBe(1);
    expect(rows.at(-1)?.position).toBe(CHART_COLUMN_ROWS);
  });

  it("keeps every row of a short chart", () => {
    expect(columnRows({ entries: entries(10) })).toHaveLength(10);
  });
});

describe("columnCaption", () => {
  it("names how many rows show and the capture day", () => {
    expect(columnCaption(CAPTURED, null)).toBe("Top 25 of 100 · Oct 14");
  });

  it("counts a chart shorter than a column", () => {
    expect(columnCaption({ ...CAPTURED, entries: entries(10) }, null)).toBe(
      "10 apps · Oct 14",
    );
    expect(columnCaption({ ...CAPTURED, entries: entries(1) }, null)).toBe(
      "1 app · Oct 14",
    );
  });

  it("names the day asked for that has no capture", () => {
    expect(columnCaption({ ...CAPTURED, capture: null }, "2026-10-12")).toBe(
      "Not captured on Oct 12",
    );
  });

  it("names today when no day was asked for", () => {
    expect(columnCaption({ ...CAPTURED, capture: null }, null)).toBe(
      "Not captured on Oct 15",
    );
  });

  it("says a chart was never captured", () => {
    expect(columnCaption({ ...CAPTURED, capture: null, dates: [] }, null)).toBe(
      "Not captured yet",
    );
  });
});

describe("capturableToday", () => {
  it("offers a capture until today is captured", () => {
    expect(capturableToday(CAPTURED)).toBe(true);
    expect(
      capturableToday({ ...CAPTURED, dates: ["2026-10-15", "2026-10-14"] }),
    ).toBe(false);
    expect(capturableToday({ ...CAPTURED, dates: [] })).toBe(true);
  });
});

describe("categoryDates", () => {
  it("joins the captured days of every kind newest first", () => {
    expect(
      categoryDates([
        { dates: ["2026-10-14", "2026-10-12"] },
        { dates: ["2026-10-13"] },
        { dates: ["2026-10-14"] },
      ]),
    ).toEqual(["2026-10-14", "2026-10-13", "2026-10-12"]);
  });

  it("answers no day for charts never captured", () => {
    expect(categoryDates([{ dates: [] }, { dates: [] }])).toEqual([]);
  });
});
