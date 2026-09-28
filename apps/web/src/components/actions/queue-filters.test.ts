import { describe, expect, it } from "vitest";
import { actionItem } from "./action-test-item";
import {
  facetCounts,
  filterQueue,
  isFilteredView,
  type QueueView,
} from "./queue-filters";

const view = (overrides: Partial<QueueView> = {}): QueueView => ({
  status: ["OPEN", "SNOOZED"],
  priority: [],
  rule: [],
  category: [],
  app: [],
  market: [],
  store: null,
  q: "",
  ...overrides,
});

const ITEMS = [
  actionItem({ id: "a", priority: "critical", rule: "keyword.add_uncovered" }),
  actionItem({
    id: "b",
    priority: "high",
    rule: "keyword.defend",
    category: "competition",
    scope: { keywordText: "streak counter" },
  }),
  actionItem({
    id: "c",
    priority: "high",
    rule: "market.improve_country",
    category: "markets",
    scope: {
      appName: "Café Planner",
      country: "at",
      keywordId: null,
      keywordText: null,
    },
  }),
  actionItem({
    id: "d",
    priority: "low",
    rule: "keyword.defend",
    category: "competition",
    scope: {
      appId: "app-gp",
      appName: "Tomato Clock",
      store: "GOOGLE_PLAY",
      country: "de",
      keywordText: "tomato timer",
    },
  }),
];

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("isFilteredView", () => {
  it("treats the default statuses in either order as unfiltered", () => {
    expect(isFilteredView(view())).toBe(false);
    expect(isFilteredView(view({ status: ["SNOOZED", "OPEN"] }))).toBe(false);
  });

  it("treats any other status set as filtered", () => {
    expect(isFilteredView(view({ status: ["DONE", "RESOLVED"] }))).toBe(true);
    expect(isFilteredView(view({ status: ["OPEN"] }))).toBe(true);
    expect(isFilteredView(view({ status: ["OPEN", "SNOOZED", "DONE"] }))).toBe(
      true,
    );
  });

  it("treats any priority or rule as filtered", () => {
    expect(isFilteredView(view({ priority: ["high"] }))).toBe(true);
    expect(isFilteredView(view({ rule: ["keyword.defend"] }))).toBe(true);
  });

  it("treats every other facet and a search as filtered", () => {
    expect(isFilteredView(view({ category: ["markets"] }))).toBe(true);
    expect(isFilteredView(view({ app: ["app-1"] }))).toBe(true);
    expect(isFilteredView(view({ market: ["de"] }))).toBe(true);
    expect(isFilteredView(view({ store: "GOOGLE_PLAY" }))).toBe(true);
    expect(isFilteredView(view({ q: "habit" }))).toBe(true);
    expect(isFilteredView(view({ q: "  " }))).toBe(false);
  });
});

describe("filterQueue", () => {
  it("ors the values of one facet", () => {
    expect(
      ids(filterQueue(ITEMS, view({ priority: ["critical", "low"] }))),
    ).toEqual(["a", "d"]);
  });

  it("ands the facets together", () => {
    expect(
      ids(
        filterQueue(
          ITEMS,
          view({ priority: ["high", "low"], rule: ["keyword.defend"] }),
        ),
      ),
    ).toEqual(["b", "d"]);
    expect(
      ids(
        filterQueue(ITEMS, view({ rule: ["keyword.defend"], market: ["de"] })),
      ),
    ).toEqual(["d"]);
  });

  it("filters by app and store", () => {
    expect(ids(filterQueue(ITEMS, view({ app: ["app-gp"] })))).toEqual(["d"]);
    expect(ids(filterQueue(ITEMS, view({ store: "APP_STORE" })))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("searches the keyword, the app name and the country name", () => {
    expect(ids(filterQueue(ITEMS, view({ q: "streak" })))).toEqual(["b"]);
    expect(ids(filterQueue(ITEMS, view({ q: "tomato clock" })))).toEqual(["d"]);
    expect(ids(filterQueue(ITEMS, view({ q: "germany" })))).toEqual(["d"]);
  });

  it("searches without accents or case", () => {
    expect(ids(filterQueue(ITEMS, view({ q: "CAFE PLANNER" })))).toEqual(["c"]);
    expect(ids(filterQueue(ITEMS, view({ q: "austria" })))).toEqual(["c"]);
  });
});

describe("facetCounts", () => {
  it("counts every value when nothing is chosen", () => {
    const counts = facetCounts(ITEMS, view());

    expect(counts.priority.get("high")).toBe(2);
    expect(counts.rule.get("keyword.defend")).toBe(2);
    expect(counts.store.get("GOOGLE_PLAY")).toBe(1);
  });

  it("counts a facet with every other facet applied", () => {
    const counts = facetCounts(ITEMS, view({ rule: ["keyword.defend"] }));

    expect(counts.priority.get("high")).toBe(1);
    expect(counts.priority.get("critical")).toBeUndefined();
    expect(counts.rule.get("keyword.add_uncovered")).toBe(1);
  });
});
