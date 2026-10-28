import { describe, expect, it } from "vitest";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import {
  EVENT_LABELS,
  PICKER_EVENTS,
  eventBadgeLabel,
  needsAStar,
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
