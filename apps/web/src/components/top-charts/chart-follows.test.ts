import { describe, expect, it } from "vitest";
import type { CategoryCollection, ChartFollowItem } from "@asobeast/shared";
import {
  categoryFollows,
  chartCategoryKey,
  chartCategoryOf,
  followedCategories,
  missingKinds,
} from "./chart-follows";

const follow = (
  id: string,
  genre: string,
  collection: CategoryCollection,
  createdAt: string,
): ChartFollowItem => ({
  id,
  store: "APP_STORE",
  country: "us",
  collection,
  genre,
  device: "iphone",
  genreName: genre,
  createdAt,
});

const GAMES = {
  store: "APP_STORE",
  country: "us",
  genre: "6014",
  device: "iphone",
} as const;

describe("chartCategoryOf", () => {
  it("drops the chart kind", () => {
    expect(
      chartCategoryOf(follow("f1", "6014", "paid", "2026-10-01T00:00:00Z")),
    ).toEqual(GAMES);
  });
});

describe("chartCategoryKey", () => {
  it("names one key for every kind of a category", () => {
    expect(chartCategoryKey(GAMES)).toBe("APP_STORE~us~6014~iphone");
    expect(
      chartCategoryKey(
        follow("f1", "6014", "grossing", "2026-10-01T00:00:00Z"),
      ),
    ).toBe(chartCategoryKey(GAMES));
  });
});

describe("followedCategories", () => {
  it("groups the kinds of a category and orders categories newest first", () => {
    const follows = [
      follow("f1", "6014", "grossing", "2026-10-01T00:00:00Z"),
      follow("f2", "6007", "free", "2026-10-02T00:00:00Z"),
      follow("f3", "6014", "free", "2026-10-03T00:00:00Z"),
    ];

    const categories = followedCategories(follows);

    expect(categories.map((category) => category.genre)).toEqual([
      "6014",
      "6007",
    ]);
    expect(categories[0].follows.map((item) => item.collection)).toEqual([
      "free",
      "grossing",
    ]);
  });

  it("tells storefronts apart", () => {
    const follows = [
      follow("f1", "6014", "free", "2026-10-01T00:00:00Z"),
      {
        ...follow("f2", "6014", "free", "2026-10-02T00:00:00Z"),
        country: "de",
      },
    ];

    expect(followedCategories(follows)).toHaveLength(2);
  });

  it("answers no category for no follows", () => {
    expect(followedCategories([])).toEqual([]);
  });
});

describe("missingKinds", () => {
  it("answers the kinds not followed in chart order", () => {
    const follows = [follow("f1", "6014", "paid", "2026-10-01T00:00:00Z")];

    expect(missingKinds(GAMES, follows)).toEqual(["free", "grossing"]);
  });

  it("answers every kind for a category nobody follows", () => {
    expect(missingKinds(GAMES, [])).toEqual(["free", "paid", "grossing"]);
  });

  it("answers nothing once every kind is followed", () => {
    const follows = (["grossing", "free", "paid"] as const).map((kind) =>
      follow(kind, "6014", kind, "2026-10-01T00:00:00Z"),
    );

    expect(missingKinds(GAMES, follows)).toEqual([]);
  });
});

describe("categoryFollows", () => {
  it("answers only the rows of that category in chart order", () => {
    const follows = [
      follow("f1", "6014", "grossing", "2026-10-01T00:00:00Z"),
      follow("f2", "6007", "free", "2026-10-02T00:00:00Z"),
      follow("f3", "6014", "free", "2026-10-03T00:00:00Z"),
    ];

    expect(categoryFollows(GAMES, follows).map((item) => item.id)).toEqual([
      "f3",
      "f1",
    ]);
  });
});
