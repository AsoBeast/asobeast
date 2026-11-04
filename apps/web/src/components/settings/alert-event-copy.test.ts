import { describe, expect, it } from "vitest";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import {
  EVENT_LABELS,
  PICKER_EVENTS,
  eventBadgeLabel,
  needsAStar,
  ratingDropTenthsToSend,
  reviewScoresToSend,
} from "./alert-event-copy";

describe("PICKER_EVENTS", () => {
  it("lists every event once", () => {
    expect([...PICKER_EVENTS].sort()).toEqual([...WEBHOOK_EVENTS].sort());
    expect(new Set(PICKER_EVENTS).size).toBe(PICKER_EVENTS.length);
  });

  it("puts New review right before Negative review", () => {
    expect(PICKER_EVENTS.indexOf("review.new") + 1).toBe(
      PICKER_EVENTS.indexOf("review.negative"),
    );
  });

  it("puts Rating dropped and Review spike right after Negative review", () => {
    const negative = PICKER_EVENTS.indexOf("review.negative");

    expect(PICKER_EVENTS.slice(negative + 1, negative + 3)).toEqual([
      "rating.dropped",
      "review.spike",
    ]);
  });

  it("ends the picker with the store availability events", () => {
    expect(PICKER_EVENTS.slice(-3)).toEqual([
      "chart.milestone",
      "app.delisted",
      "app.unlisted_market",
    ]);
  });

  it("names every event", () => {
    expect(Object.keys(EVENT_LABELS).sort()).toEqual(
      [...WEBHOOK_EVENTS].sort(),
    );
  });
});

describe("reviewScoresToSend", () => {
  it("sends no filter without the new review event", () => {
    expect(reviewScoresToSend(["rank.dropped"], [1])).toBeUndefined();
  });

  it("sends every star as an empty filter", () => {
    expect(reviewScoresToSend(["review.new"], [1, 2, 3, 4, 5])).toEqual([]);
  });

  it("sends the picked stars in order", () => {
    expect(reviewScoresToSend(["review.new"], [2, 1])).toEqual([1, 2]);
  });
});

describe("needsAStar", () => {
  it("asks for a star only while New review is ticked", () => {
    expect(needsAStar(["review.new"], [])).toBe(true);
    expect(needsAStar(["rank.dropped"], [])).toBe(false);
    expect(needsAStar(["review.new"], [5])).toBe(false);
  });
});

describe("eventBadgeLabel", () => {
  it("names the stars of a filtered new review", () => {
    expect(eventBadgeLabel("review.new", [1, 2])).toBe(
      "New review · 1 and 2 stars",
    );
  });

  it("names a new review of every star plainly", () => {
    expect(eventBadgeLabel("review.new", [])).toBe("New review");
    expect(eventBadgeLabel("review.new", undefined)).toBe("New review");
  });

  it("ignores the stars on another event", () => {
    expect(eventBadgeLabel("rank.dropped", [1])).toBe("Rank dropped");
  });
});

describe("ratingDropTenthsToSend", () => {
  it("sends the threshold only while Rating dropped is ticked", () => {
    expect(ratingDropTenthsToSend(["rating.dropped"], 3)).toBe(3);
    expect(ratingDropTenthsToSend(["rank.dropped"], 3)).toBeUndefined();
  });
});

describe("eventBadgeLabel for a rating drop", () => {
  it("names the threshold of a rating drop", () => {
    expect(
      eventBadgeLabel("rating.dropped", undefined, { ratingDropTenths: 2 }),
    ).toBe("Rating dropped · 0.2 stars");
    expect(
      eventBadgeLabel("rating.dropped", undefined, { ratingDropTenths: 1 }),
    ).toBe("Rating dropped · 0.1 star");
    expect(eventBadgeLabel("rating.dropped", undefined)).toBe("Rating dropped");
  });

  it("ignores the threshold on another event", () => {
    expect(
      eventBadgeLabel("rank.dropped", undefined, { ratingDropTenths: 3 }),
    ).toBe("Rank dropped");
  });
});

describe("eventBadgeLabel for a rank drop", () => {
  it("names the threshold of the subscription", () => {
    expect(
      eventBadgeLabel("rank.dropped", undefined, { rankDropThreshold: 10 }),
    ).toBe("Rank dropped · 10+");
    expect(
      eventBadgeLabel("rank.dropped", undefined, { rankDropThreshold: null }),
    ).toBe("Rank dropped");
  });
});
