import { describe, expect, it } from "vitest";
import type { ChangeEventItem } from "@asobeast/shared";
import { competitorLede } from "./competitor-lede";

const event = (overrides: Partial<ChangeEventItem>): ChangeEventItem => ({
  id: "chg",
  appId: "comp-1",
  appName: "Rival Focus",
  isCompetitor: true,
  field: "subtitle",
  before: "a",
  after: "b",
  capturedAt: "2026-11-10T03:04:05.000Z",
  ...overrides,
});

describe("competitorLede", () => {
  it("asks for a first competitor when none is tracked", () => {
    expect(competitorLede(0, [event({})])).toEqual({
      count: "No competitors",
      rest: "tracked yet. Add the apps you rank against to see where they beat you.",
      changed: null,
    });
  });

  it("keeps to the count while the listing changes are unknown", () => {
    expect(competitorLede(2, undefined)).toEqual({
      count: "2 competitors",
      rest: "tracked.",
      changed: null,
    });
  });

  it("says nothing changed when only the own app has events", () => {
    expect(competitorLede(2, [event({ isCompetitor: false })])).toEqual({
      count: "2 competitors",
      rest: "tracked. No listing changes in the last 7 days.",
      changed: null,
    });
  });

  it("names the newest competitor change with its field and UTC day", () => {
    const lede = competitorLede(1, [
      event({
        id: "old",
        field: "title",
        capturedAt: "2026-11-08T23:59:59.000Z",
      }),
      event({ id: "new" }),
    ]);
    expect(lede).toEqual({
      count: "1 competitor",
      rest: "tracked.",
      changed: { name: "Rival Focus", rest: "changed its subtitle on Nov 10." },
    });
  });

  it("counts the other competitors that changed", () => {
    const events = [
      event({}),
      event({
        id: "b",
        appId: "comp-2",
        appName: "Other",
        capturedAt: "2026-11-09T01:00:00.000Z",
      }),
      event({
        id: "c",
        appId: "comp-3",
        appName: null,
        capturedAt: "2026-11-08T01:00:00.000Z",
      }),
    ];
    expect(competitorLede(3, events).changed?.rest).toBe(
      "changed its subtitle on Nov 10. 2 more changed their listing in the last 7 days.",
    );
    expect(competitorLede(3, events.slice(0, 2)).changed?.rest).toBe(
      "changed its subtitle on Nov 10. 1 more changed its listing in the last 7 days.",
    );
  });

  it("falls back to a placeholder name", () => {
    expect(competitorLede(1, [event({ appName: null })]).changed?.name).toBe(
      "Competitor",
    );
  });
});
