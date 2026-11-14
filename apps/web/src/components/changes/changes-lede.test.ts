import { describe, expect, it } from "vitest";
import type {
  ChangeEventItem,
  ChangeField,
  ChangeImpactReport,
} from "@asobeast/shared";
import { changesLede } from "./changes-lede";

const event = (
  day: string,
  field: ChangeField,
  rival?: { id: string; name: string },
): ChangeEventItem => ({
  id: `${day}-${field}-${rival?.id ?? "own"}`,
  appId: rival?.id ?? "app-1",
  appName: rival?.name ?? "Focus Timer",
  isCompetitor: rival !== undefined,
  field,
  before: null,
  after: null,
  capturedAt: `${day}T12:00:00.000Z`,
});

const RIVAL = { id: "comp-1", name: "Rival Focus" };

const text = (parts: ReturnType<typeof changesLede>): string =>
  parts.map((part) => part.text).join("");

const IMPACT: ChangeImpactReport = {
  appId: "app-1",
  country: "us",
  days: 90,
  totalChanges: 2,
  items: [
    {
      changedOn: "2026-11-11",
      fields: ["title"],
      baselineDate: "2026-11-10",
      windows: [
        {
          days: 7,
          status: "pending",
          targetDate: "2026-11-18",
          measuredOn: null,
          movement: null,
          medianPositionChange: null,
          visibilityBefore: null,
          visibilityAfter: null,
          visibilityChange: null,
          overlappingChanges: [],
        },
      ],
    },
    {
      changedOn: "2026-10-31",
      fields: ["icon"],
      baselineDate: "2026-10-30",
      windows: [
        {
          days: 7,
          status: "measured",
          targetDate: "2026-11-07",
          measuredOn: "2026-11-07",
          movement: null,
          medianPositionChange: null,
          visibilityBefore: 38.4,
          visibilityAfter: 42.1,
          visibilityChange: 3.7,
          overlappingChanges: [],
        },
      ],
    },
  ],
};

describe("changesLede", () => {
  it("names the newest day, its fields and the last measured effect", () => {
    const parts = changesLede({
      events: [
        event("2026-11-11", "title"),
        event("2026-11-11", "description"),
        event("2026-11-10", "price", RIVAL),
      ],
      impact: IMPACT,
      days: 90,
    });

    expect(text(parts)).toBe(
      "On Nov 11, you changed the title and description. Your change of Nov 11 is measurable on Nov 18. Your icon change of Oct 31 was followed by visibility up 3.7 after 7 days.",
    );
    expect(
      parts.filter((part) => part.strong).map((part) => part.text),
    ).toEqual(["Nov 11", "the title and description", "up 3.7"]);
  });

  it("names one competitor and joins it to the own change", () => {
    const parts = changesLede({
      events: [
        event("2026-11-11", "title"),
        event("2026-11-11", "screenshots", RIVAL),
        event("2026-11-11", "screenshotImages", RIVAL),
      ],
      impact: null,
      days: 30,
    });

    expect(text(parts)).toBe(
      "On Nov 11, you changed the title; Rival Focus changed its screenshots.",
    );
  });

  it("counts several competitors instead of naming them", () => {
    const parts = changesLede({
      events: [
        event("2026-11-11", "price", RIVAL),
        event("2026-11-11", "icon", { id: "comp-2", name: "Deep Work" }),
      ],
      impact: null,
      days: 30,
    });

    expect(text(parts)).toBe(
      "On Nov 11, 2 competitors changed their listings.",
    );
  });

  it("counts the fields when more than three changed", () => {
    const parts = changesLede({
      events: [
        event("2026-11-11", "title"),
        event("2026-11-11", "subtitle"),
        event("2026-11-11", "price"),
        event("2026-11-11", "icon"),
      ],
      impact: null,
      days: 30,
    });

    expect(text(parts)).toBe("On Nov 11, you changed 4 fields.");
  });

  it("leaves the fields out of the effect when more than three changed", () => {
    const [, measured] = IMPACT.items;
    const parts = changesLede({
      events: [event("2026-10-31", "title")],
      impact: {
        ...IMPACT,
        items: [
          { ...measured, fields: ["title", "subtitle", "icon", "price"] },
        ],
      },
      days: 90,
    });

    expect(text(parts)).toContain(
      "Your change of Oct 31 was followed by visibility up 3.7 after 7 days.",
    );
  });

  it("says so when the window holds no change", () => {
    expect(text(changesLede({ events: [], impact: null, days: 365 }))).toBe(
      "No listing changes in the last 365 days, yours or a competitor's.",
    );
  });
});
