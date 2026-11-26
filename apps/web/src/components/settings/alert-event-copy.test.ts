import { describe, expect, it } from "vitest";
import { WEBHOOK_EVENTS } from "@asobeast/shared";
import { translationContext } from "@/test/translation-context";
import {
  EVENT_LABELS,
  PICKER_EVENTS,
  eventBadgeLabel,
  eventLabel,
  needsAStar,
  ratingDropTenthsToSend,
  reviewScoresToSend,
} from "./alert-event-copy";

const en = translationContext("en", "notifications");
const zh = translationContext("zh-CN", "notifications");

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
    expect(eventBadgeLabel("review.new", [1, 2], {}, en)).toBe(
      "New review · 1 and 2 stars",
    );
  });

  it("names a new review of every star plainly", () => {
    expect(eventBadgeLabel("review.new", [], {}, en)).toBe("New review");
    expect(eventBadgeLabel("review.new", undefined, {}, en)).toBe("New review");
  });

  it("ignores the stars on another event", () => {
    expect(eventBadgeLabel("rank.dropped", [1], {}, en)).toBe("Rank dropped");
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
      eventBadgeLabel("rating.dropped", undefined, { ratingDropTenths: 2 }, en),
    ).toBe("Rating dropped · 0.2 stars");
    expect(
      eventBadgeLabel("rating.dropped", undefined, { ratingDropTenths: 1 }, en),
    ).toBe("Rating dropped · 0.1 star");
    expect(eventBadgeLabel("rating.dropped", undefined, {}, en)).toBe(
      "Rating dropped",
    );
  });

  it("ignores the threshold on another event", () => {
    expect(
      eventBadgeLabel("rank.dropped", undefined, { ratingDropTenths: 3 }, en),
    ).toBe("Rank dropped");
  });
});

describe("eventBadgeLabel for a rank drop", () => {
  it("names the threshold of the subscription", () => {
    expect(
      eventBadgeLabel("rank.dropped", undefined, { rankDropThreshold: 10 }, en),
    ).toBe("Rank dropped · 10+");
    expect(
      eventBadgeLabel(
        "rank.dropped",
        undefined,
        { rankDropThreshold: null },
        en,
      ),
    ).toBe("Rank dropped");
  });
});

describe("localized event labels", () => {
  it("translates stable event codes without changing them", () => {
    expect(eventLabel("rank.dropped", zh.translator)).toBe("排名下降");
    expect(eventLabel("app.unlisted_market", zh.translator)).toBe(
      "已在某市场下架",
    );
    expect(EVENT_LABELS["rank.dropped"]).toBe("Rank dropped");
  });

  it("localizes review and threshold badges", () => {
    expect(eventBadgeLabel("review.new", [1, 2], {}, zh)).toBe(
      "新评论 · 1和2 星",
    );
    expect(
      eventBadgeLabel("rating.dropped", undefined, { ratingDropTenths: 2 }, zh),
    ).toBe("评分下降 · 0.2 星");
    expect(
      eventBadgeLabel("rank.dropped", undefined, { rankDropThreshold: 10 }, zh),
    ).toBe("排名下降 · 10+");
  });
});
