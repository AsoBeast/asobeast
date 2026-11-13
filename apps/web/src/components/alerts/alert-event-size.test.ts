import { describe, expect, it } from "vitest";
import type { AlertEventItem } from "@asobeast/shared";
import { ALERT_EVENT_ITEMS } from "../../../e2e/alert-feed-fixtures.mts";
import { alertEventSize } from "./alert-event-size";

type Payload = AlertEventItem["payload"];

function payloadOf(id: string): Payload {
  const found = ALERT_EVENT_ITEMS.find((item) => item.id === id);
  if (!found) throw new Error(`No fixture event ${id}`);
  return found.payload;
}

describe("alertEventSize", () => {
  it("measures a drop as positions lost", () => {
    expect(alertEventSize(payloadOf("evt-drop-us"))).toEqual({
      value: 8,
      polarity: "lower-is-better",
      period: "positions",
    });
  });

  it("measures a climb as positions gained", () => {
    expect(alertEventSize(payloadOf("evt-cafe"))).toEqual({
      value: -9,
      polarity: "lower-is-better",
      period: "positions",
    });
  });

  it("measures a keyword and a chart milestone by the positions crossed", () => {
    expect(alertEventSize(payloadOf("evt-milestone"))?.value).toBe(-6);
    expect(alertEventSize(payloadOf("evt-chart-milestone"))?.value).toBe(-4);
  });

  it("measures an overtake by the own app's move and names one position in the singular", () => {
    expect(alertEventSize(payloadOf("evt-overtaken"))).toEqual({
      value: 1,
      polarity: "lower-is-better",
      period: "position",
    });
  });

  it("measures a rating drop in stars", () => {
    expect(alertEventSize(payloadOf("evt-rating"))).toEqual({
      value: -0.2,
      polarity: "higher-is-better",
      period: "stars",
    });
  });

  it("has no size when a position fell out of the checked depth", () => {
    const drop = payloadOf("evt-drop-us");
    if (drop.event !== "rank.dropped") throw new Error("Not a drop");

    expect(alertEventSize({ ...drop, to: null })).toBeNull();
  });

  it("has no size when the own app kept its position", () => {
    const overtaken = payloadOf("evt-overtaken");
    if (overtaken.event !== "rank.overtaken")
      throw new Error("Not an overtake");

    expect(alertEventSize({ ...overtaken, to: overtaken.from })).toBeNull();
  });

  it("has no size when a rating drop rounds to nothing", () => {
    const rating = payloadOf("evt-rating");
    if (rating.event !== "rating.dropped") throw new Error("Not a rating");

    expect(alertEventSize({ ...rating, dropTenths: 0 })).toBeNull();
  });

  it.each([
    "evt-change-rival",
    "evt-first",
    "evt-review-arabic",
    "evt-entrant",
    "evt-action",
    "evt-chart-gp",
  ])("has no size for %s, which measures no move", (id) => {
    expect(alertEventSize(payloadOf(id))).toBeNull();
  });
});
