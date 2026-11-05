import {
  RANK_DEPTH,
  type AlertEventItem,
  type ReviewNegativePayload,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { formatDate } from "@/lib/format";
import { dayGroups, searchEvents } from "./alert-feed-view";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");

function rankItem(
  id: string,
  occurredAt: string,
  overrides: Partial<AlertEventItem> = {},
): AlertEventItem {
  return {
    id,
    event: "rank.dropped",
    occurredAt,
    sentence: 'Focus Timer fell from #4 to #12 for "focus timer" in US',
    appId: "app-1",
    appName: "Focus Timer",
    iconUrl: null,
    store: "APP_STORE",
    country: "us",
    primaryAppId: "app-1",
    payload: {
      event: "rank.dropped",
      occurredAt,
      app: { id: "app-1", name: "Focus Timer" },
      keyword: {
        id: "kw-1",
        text: "focus timer",
        store: "APP_STORE",
        country: "us",
      },
      from: 4,
      to: 12,
      fromDepth: RANK_DEPTH,
      toDepth: RANK_DEPTH,
      threshold: 5,
    },
    ...overrides,
  };
}

const review: ReviewNegativePayload = {
  event: "review.negative",
  occurredAt: "2026-11-03T01:00:00.000Z",
  app: { id: "app-gp", name: null },
  review: {
    score: 1,
    title: null,
    text: "bad",
    version: null,
    reviewedAt: null,
  },
};

const bare: AlertEventItem = {
  ...rankItem("bare", "2026-11-03T01:00:00.000Z"),
  event: "review.negative",
  sentence: "A 1 star review arrived",
  appId: "app-gp",
  appName: null,
  country: null,
  payload: review,
};

describe("dayGroups", () => {
  it("groups adjacent events by their UTC day in the order given", () => {
    const groups = dayGroups(
      [
        rankItem("a", "2026-11-03T10:00:00.000Z"),
        rankItem("b", "2026-11-03T00:00:00.001Z"),
        rankItem("c", "2026-11-02T23:59:59.999Z"),
        rankItem("d", "2026-10-30T08:00:00.000Z"),
      ],
      NOW,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "2026-11-03",
      "2026-11-02",
      "2026-10-30",
    ]);
    expect(
      groups.map((group) => group.events.map((event) => event.id)),
    ).toEqual([["a", "b"], ["c"], ["d"]]);
  });

  it("splits two events a few milliseconds apart across midnight UTC", () => {
    const groups = dayGroups(
      [
        rankItem("after", "2026-11-03T00:00:00.001Z"),
        rankItem("before", "2026-11-02T23:59:59.999Z"),
      ],
      NOW,
    );

    expect(groups).toHaveLength(2);
  });

  it("never merges days that are not adjacent in the list", () => {
    const groups = dayGroups(
      [
        rankItem("a", "2026-11-03T10:00:00.000Z"),
        rankItem("b", "2026-11-02T10:00:00.000Z"),
        rankItem("c", "2026-11-03T09:00:00.000Z"),
      ],
      NOW,
    );

    expect(groups.map((group) => group.key)).toEqual([
      "2026-11-03",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("labels today, yesterday and older days from the given clock", () => {
    const labels = dayGroups(
      [
        rankItem("a", "2026-11-03T00:30:00.000Z"),
        rankItem("b", "2026-11-02T23:30:00.000Z"),
        rankItem("c", "2026-10-30T08:00:00.000Z"),
      ],
      NOW,
    ).map((group) => group.label);

    expect(labels).toEqual([
      "Today",
      "Yesterday",
      formatDate("2026-10-30T00:00:00.000Z"),
    ]);
  });

  it("answers no group for no event", () => {
    expect(dayGroups([], NOW)).toEqual([]);
  });
});

describe("searchEvents", () => {
  const us = rankItem("us", "2026-11-03T10:00:00.000Z");
  const de = rankItem("de", "2026-11-03T09:00:00.000Z", {
    country: "de",
    sentence: 'Focus Timer fell from #4 to #12 for "pomodoro" in DE',
  });
  const cafe = rankItem("cafe", "2026-11-03T08:00:00.000Z", {
    event: "rank.improved",
    sentence: 'Focus Timer climbed from #18 to #9 for "café timer" in FR',
    country: "fr",
    payload: {
      ...us.payload,
      event: "rank.improved",
    } as AlertEventItem["payload"],
  });
  const events = [us, de, cafe, bare];

  it("finds an event by its market name", () => {
    expect(searchEvents(events, "germany").map((event) => event.id)).toEqual([
      "de",
    ]);
  });

  it("matches accents and case loosely", () => {
    expect(searchEvents(events, "CAFE").map((event) => event.id)).toEqual([
      "cafe",
    ]);
    expect(searchEvents(events, "Café").map((event) => event.id)).toEqual([
      "cafe",
    ]);
  });

  it("finds an event by its label", () => {
    expect(
      searchEvents(events, "rank dropped").map((event) => event.id),
    ).toEqual(["us", "de"]);
  });

  it("returns every event for an empty query", () => {
    expect(searchEvents(events, "  ")).toEqual(events);
  });

  it("reads an event without an app name or market without matching null", () => {
    expect(searchEvents([bare], "null")).toEqual([]);
    expect(searchEvents([bare], "undefined")).toEqual([]);
    expect(searchEvents([bare], "negative review")).toEqual([bare]);
  });

  it("matches nothing for an emoji the sentences never hold", () => {
    expect(searchEvents(events, "🔥")).toEqual([]);
  });
});
