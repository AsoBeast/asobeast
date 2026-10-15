import { describe, expect, it } from "vitest";
import {
  categoryTitle,
  chartHref,
  chartKeyFrom,
  chartQueryFrom,
  chartTitle,
  shownChartKey,
  stepDate,
  storeChanged,
  tableHref,
  type ChartSearch,
} from "./chart-params";

const SEARCH: ChartSearch = {
  view: "columns",
  store: "APP_STORE",
  country: "",
  collection: "free",
  genre: "overall",
  device: null,
  date: null,
  compare: "1d",
};

describe("chartKeyFrom", () => {
  it("fills the default country and the store's device", () => {
    expect(chartKeyFrom(SEARCH)).toEqual({
      store: "APP_STORE",
      country: "us",
      collection: "free",
      genre: "overall",
      device: "iphone",
    });
    expect(chartKeyFrom({ ...SEARCH, store: "GOOGLE_PLAY" }).device).toBe(
      "android",
    );
  });

  it("reads overall for a genre the store does not chart", () => {
    expect(chartKeyFrom({ ...SEARCH, genre: "GAME_PUZZLE" }).genre).toBe(
      "overall",
    );
    expect(
      chartKeyFrom({ ...SEARCH, store: "GOOGLE_PLAY", genre: "GAME_PUZZLE" })
        .genre,
    ).toBe("GAME_PUZZLE");
  });

  it("reads the store's device for a device it does not chart", () => {
    expect(
      chartKeyFrom({ ...SEARCH, store: "GOOGLE_PLAY", device: "iphone" })
        .device,
    ).toBe("android");
  });

  it("keeps a storefront the store has and replaces one it lacks", () => {
    expect(chartKeyFrom({ ...SEARCH, country: "de" }).country).toBe("de");
    expect(chartKeyFrom({ ...SEARCH, country: "zz" }).country).toBe("us");
  });
});

describe("chartQueryFrom", () => {
  it("adds the day only when one is picked", () => {
    expect(chartQueryFrom(SEARCH)).not.toHaveProperty("date");
    expect(chartQueryFrom({ ...SEARCH, date: "2026-10-13" })).toMatchObject({
      date: "2026-10-13",
      compare: "1d",
    });
  });
});

describe("chartTitle", () => {
  it("names the chart kind, the category and the country", () => {
    expect(
      chartTitle({
        ...chartKeyFrom(SEARCH),
        genre: "6014",
        collection: "paid",
      }),
    ).toBe("Top paid · Games · United States");
  });
});

describe("categoryTitle", () => {
  it("names the category and the country without a kind", () => {
    expect(
      categoryTitle({
        store: "APP_STORE",
        country: "us",
        genre: "6014",
        device: "iphone",
      }),
    ).toBe("Games · United States");
  });

  it("falls back to the genre id the store does not name", () => {
    expect(
      categoryTitle({
        store: "APP_STORE",
        country: "de",
        genre: "9999",
        device: "iphone",
      }),
    ).toBe("9999 · Germany");
  });
});

describe("stepDate", () => {
  const DATES = ["2026-10-13", "2026-10-11", "2026-10-08"];

  it("steps to the neighbouring captured day", () => {
    expect(stepDate(DATES, "2026-10-11", -1)).toBe("2026-10-08");
    expect(stepDate(DATES, "2026-10-11", 1)).toBe("2026-10-13");
  });

  it("steps from a day without a capture to the nearest one", () => {
    expect(stepDate(DATES, "2026-10-12", -1)).toBe("2026-10-11");
    expect(stepDate(DATES, "2026-10-12", 1)).toBe("2026-10-13");
  });

  it("stops at either end", () => {
    expect(stepDate(DATES, "2026-10-13", 1)).toBeNull();
    expect(stepDate(DATES, "2026-10-08", -1)).toBeNull();
  });
});

describe("chartHref", () => {
  it("links a category to its columns", () => {
    expect(
      chartHref({
        store: "APP_STORE",
        country: "us",
        genre: "6014",
        device: "iphone",
      }),
    ).toBe("/charts?store=APP_STORE&country=us&genre=6014&device=iphone");
  });
});

describe("tableHref", () => {
  const PAID = {
    store: "GOOGLE_PLAY",
    country: "de",
    collection: "paid",
    genre: "GAME_PUZZLE",
    device: "android",
  } as const;

  it("links one kind to its table", () => {
    expect(tableHref(PAID)).toBe(
      "/charts?store=GOOGLE_PLAY&country=de&genre=GAME_PUZZLE&device=android&view=table&collection=paid",
    );
  });

  it("keeps the day and a comparison other than the default", () => {
    expect(tableHref(PAID, { compare: "7d", date: "2026-10-13" })).toBe(
      "/charts?store=GOOGLE_PLAY&country=de&genre=GAME_PUZZLE&device=android&view=table&collection=paid&compare=7d&date=2026-10-13",
    );
    expect(tableHref(PAID, { compare: "1d", date: null })).toBe(
      tableHref(PAID),
    );
  });
});

describe("storeChanged", () => {
  it("resets the category, device and day and keeps a shared storefront", () => {
    expect(storeChanged("GOOGLE_PLAY", { country: "de" })).toEqual({
      store: "GOOGLE_PLAY",
      genre: null,
      device: null,
      date: null,
      country: "de",
    });
  });

  it("drops a storefront the next store lacks", () => {
    expect(storeChanged("APP_STORE", { country: "zz" }).country).toBeNull();
  });
});

describe("shownChartKey", () => {
  it("reads the key of the chart a page answered", () => {
    expect(
      shownChartKey({
        chart: { ...chartKeyFrom(SEARCH), genreName: "Overall" },
      }),
    ).toEqual(chartKeyFrom(SEARCH));
  });
});
