import { describe, expect, it } from "vitest";
import type { AppEventRef, ChangeEventItem, StoryRef } from "@asobeast/shared";
import {
  eventMeta,
  eventTitle,
  isStoreField,
  storyTitle,
  storeChangeSummary,
} from "./store-change";

const base: Omit<ChangeEventItem, "field" | "before" | "after"> = {
  id: "e1",
  appId: "app-1",
  appName: "Focus Timer",
  isCompetitor: false,
  capturedAt: "2026-11-10T03:00:00.000Z",
};

const appEvent = (overrides: Partial<AppEventRef>): AppEventRef => ({
  appEventId: "evt-1",
  title: "Winter Challenge",
  kind: "Challenge",
  badge: "Live now",
  startsAt: "2026-11-20T09:00:00Z",
  endsAt: "2026-12-05T21:00:00Z",
  ...overrides,
});

const story = (overrides: Partial<StoryRef>): StoryRef => ({
  storyId: "story-1",
  heading: "App of the day",
  title: "Calm your mind",
  ...overrides,
});

const event = (
  field: ChangeEventItem["field"],
  detail: ChangeEventItem["detail"],
): ChangeEventItem => ({ ...base, field, before: null, after: null, detail });

describe("isStoreField", () => {
  it("is true for the three store surfaces only", () => {
    expect(isStoreField("inAppEvents")).toBe(true);
    expect(isStoreField("featuring")).toBe(true);
    expect(isStoreField("editorsChoice")).toBe(true);
    expect(isStoreField("screenshots")).toBe(false);
    expect(isStoreField("title")).toBe(false);
  });
});

describe("eventTitle", () => {
  it("falls back to the kind and then to neutral wording", () => {
    expect(eventTitle(appEvent({}))).toBe("Winter Challenge");
    expect(eventTitle(appEvent({ title: null, kind: "Competition" }))).toBe(
      "Competition",
    );
    expect(eventTitle(appEvent({ title: null, kind: null }))).toBe(
      "In-app event",
    );
  });
});

describe("storyTitle", () => {
  it("falls back to the heading and then to neutral wording", () => {
    expect(storyTitle(story({}))).toBe("Calm your mind");
    expect(storyTitle(story({ title: null }))).toBe("App of the day");
    expect(storyTitle(story({ title: null, heading: null }))).toBe(
      "Featured story",
    );
  });
});

describe("eventMeta", () => {
  it("joins the kind, the badge and the date range", () => {
    expect(eventMeta(appEvent({}))).toBe(
      "Challenge · Live now · Nov 20 to Dec 5",
    );
  });

  it("skips the kind when it already names the row", () => {
    expect(eventMeta(appEvent({ title: null, badge: null }))).toBe(
      "Nov 20 to Dec 5",
    );
    expect(
      eventMeta(
        appEvent({
          title: null,
          kind: null,
          badge: "Live now",
          endsAt: null,
        }),
      ),
    ).toBe("Live now · From Nov 20");
  });

  it("reads a range with one side as from or until", () => {
    expect(eventMeta(appEvent({ endsAt: null }))).toBe(
      "Challenge · Live now · From Nov 20",
    );
    expect(
      eventMeta(appEvent({ startsAt: null, badge: null, kind: null })),
    ).toBe("Until Dec 5");
    expect(eventMeta(appEvent({ startsAt: null, endsAt: null }))).toBe(
      "Challenge · Live now",
    );
    expect(
      eventMeta(
        appEvent({
          kind: null,
          badge: null,
          startsAt: null,
          endsAt: null,
        }),
      ),
    ).toBeNull();
  });
});

describe("storeChangeSummary", () => {
  it("names the one event added or removed", () => {
    expect(
      storeChangeSummary(
        event("inAppEvents", {
          kind: "events",
          added: [appEvent({})],
          removed: [],
        }),
      ),
    ).toBe("Event added: Winter Challenge");
    expect(
      storeChangeSummary(
        event("inAppEvents", {
          kind: "events",
          added: [],
          removed: [appEvent({ title: null, kind: null })],
        }),
      ),
    ).toBe("Event removed");
  });

  it("names both directions and falls back to the kind", () => {
    expect(
      storeChangeSummary(
        event("inAppEvents", {
          kind: "events",
          added: [appEvent({})],
          removed: [
            appEvent({ appEventId: "evt-0", title: null, kind: "Competition" }),
          ],
        }),
      ),
    ).toBe("Event added: Winter Challenge, Event removed: Competition");
  });

  it("counts when several events changed on a side", () => {
    expect(
      storeChangeSummary(
        event("inAppEvents", {
          kind: "events",
          added: [appEvent({}), appEvent({ appEventId: "evt-2" })],
          removed: [appEvent({ appEventId: "evt-0" })],
        }),
      ),
    ).toBe("2 events added, Event removed: Winter Challenge");
    expect(
      storeChangeSummary(
        event("inAppEvents", {
          kind: "events",
          added: [],
          removed: [
            appEvent({ appEventId: "evt-0" }),
            appEvent({ appEventId: "evt-3" }),
          ],
        }),
      ),
    ).toBe("2 events removed");
  });

  it("names the one story added or removed", () => {
    expect(
      storeChangeSummary(
        event("featuring", {
          kind: "featuring",
          added: [story({})],
          removed: [],
        }),
      ),
    ).toBe("Featured story added: Calm your mind");
    expect(
      storeChangeSummary(
        event("featuring", {
          kind: "featuring",
          added: [],
          removed: [story({ title: null, heading: null })],
        }),
      ),
    ).toBe("Featured story removed");
  });

  it("says the Editors' Choice badge was added or removed", () => {
    expect(
      storeChangeSummary(
        event("editorsChoice", {
          kind: "editorsChoice",
          showsBadge: true,
          notes: null,
        }),
      ),
    ).toBe("Editors' Choice badge added");
    expect(
      storeChangeSummary(
        event("editorsChoice", {
          kind: "editorsChoice",
          showsBadge: false,
          notes: null,
        }),
      ),
    ).toBe("Editors' Choice badge removed");
  });

  it("says nothing when the detail is missing", () => {
    expect(storeChangeSummary(event("inAppEvents", null))).toBe("");
    expect(storeChangeSummary(event("featuring", undefined))).toBe("");
    expect(
      storeChangeSummary(
        event("screenshotCaptions", {
          kind: "captions",
          added: ["Plan your day"],
          removed: ["Plan your week"],
        }),
      ),
    ).toBe("");
  });
});
