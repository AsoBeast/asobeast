import { describe, expect, it } from "vitest";
import type { ChangeEventItem, ChangeField } from "@asobeast/shared";
import {
  changedFieldWords,
  changeKind,
  fieldCounts,
  matchesFilter,
  ownerCounts,
} from "./change-fields";

const event = (field: ChangeField, isCompetitor = false): ChangeEventItem => ({
  id: `${field}-${isCompetitor}`,
  appId: isCompetitor ? "comp-1" : "app-1",
  appName: isCompetitor ? "Rival" : "Mine",
  isCompetitor,
  field,
  before: null,
  after: null,
  capturedAt: "2026-11-10T12:00:00.000Z",
});

describe("fieldCounts", () => {
  it("counts the three screenshot fields as one group, per owner", () => {
    const counts = fieldCounts([
      event("screenshots"),
      event("screenshotCaptions"),
      event("screenshotImages", true),
      event("title"),
    ]);

    expect(counts).toEqual([
      { group: "screenshots", yours: 2, competitors: 1 },
      { group: "title", yours: 1, competitors: 0 },
    ]);
  });

  it("orders ties as the fields are declared", () => {
    const counts = fieldCounts([event("price"), event("title")]);

    expect(counts.map((count) => count.group)).toEqual(["title", "price"]);
  });
});

describe("matchesFilter", () => {
  it("keeps an event of the owner and the field group", () => {
    const captions = event("screenshotCaptions", true);

    expect(
      matchesFilter(captions, { owner: "competitors", field: "screenshots" }),
    ).toBe(true);
    expect(matchesFilter(captions, { owner: "yours", field: null })).toBe(
      false,
    );
    expect(matchesFilter(captions, { owner: "all", field: "title" })).toBe(
      false,
    );
  });
});

describe("ownerCounts", () => {
  it("splits the events by owner", () => {
    expect(
      ownerCounts([event("title"), event("price", true), event("icon")]),
    ).toEqual({ all: 3, yours: 2, competitors: 1 });
  });
});

describe("changeKind", () => {
  it("sorts every field into text, visuals or release", () => {
    expect(changeKind("summary")).toBe("text");
    expect(changeKind("screenshotCaptions")).toBe("visuals");
    expect(changeKind("icon")).toBe("visuals");
    expect(changeKind("whatsNew")).toBe("release");
    expect(changeKind("price")).toBe("release");
  });
});

describe("changedFieldWords", () => {
  it("names each group once in lower case", () => {
    expect(
      changedFieldWords(["title", "screenshots", "screenshotImages"]),
    ).toBe("title and screenshots");
    expect(changedFieldWords(["whatsNew"])).toBe("what's new");
  });
});
