import { describe, expect, it } from "vitest";
import {
  changedFields,
  draftFieldsOf,
  draftRequest,
  draftValues,
  listingDraftKey,
  parseListingDraft,
  serializeListingDraft,
} from "./listing-draft";

const live = { title: "Focus Timer", subtitle: "Pomodoro", keywordField: "" };

describe("parseListingDraft", () => {
  it("reads a stored draft", () => {
    expect(parseListingDraft('{"v":1,"title":"Habit Tracker"}')).toEqual({
      title: "Habit Tracker",
    });
  });

  it("reads nothing from an empty or broken value", () => {
    for (const raw of [null, "", "{", "null", "[]", '"title"']) {
      expect(parseListingDraft(raw)).toBeNull();
    }
  });

  it("refuses another version", () => {
    expect(parseListingDraft('{"v":2,"title":"Habit"}')).toBeNull();
  });

  it("drops unknown keys and non string values", () => {
    expect(parseListingDraft('{"v":1,"title":3,"notes":"x"}')).toEqual({});
  });
});

describe("serializeListingDraft", () => {
  it("keeps every edited field as typed", () => {
    expect(
      parseListingDraft(
        serializeListingDraft({ title: "Focus Timer", subtitle: "" }),
      ),
    ).toEqual({ title: "Focus Timer", subtitle: "" });
  });

  it("writes an empty string for no edits", () => {
    expect(serializeListingDraft({})).toBe("");
    expect(parseListingDraft(serializeListingDraft({}))).toBeNull();
  });
});

describe("draftValues", () => {
  it("reads the live value for a field the draft leaves out", () => {
    expect(draftValues({ title: "Habit" }, live)).toEqual({
      ...live,
      title: "Habit",
    });
    expect(draftValues(null, live)).toEqual(live);
  });
});

describe("changedFields", () => {
  it("answers the fields that differ from the live listing", () => {
    expect(
      changedFields({ ...live, title: "Habit", keywordField: "" }, live),
    ).toEqual(["title"]);
  });
});

describe("listingDraftKey", () => {
  it("keys a draft by app and scope", () => {
    expect(listingDraftKey("app-1", "en-US")).toBe(
      "asobeast.listingDraft.app-1.en-US",
    );
  });
});

describe("draftFieldsOf", () => {
  it("lists the indexed fields of each store and the description", () => {
    expect(draftFieldsOf("APP_STORE")).toEqual([
      "title",
      "subtitle",
      "keywordField",
      "description",
    ]);
    expect(draftFieldsOf("GOOGLE_PLAY")).toEqual([
      "title",
      "shortDescription",
      "description",
    ]);
  });
});

describe("draftRequest", () => {
  it("sends only the changed fields with the localization on the App Store", () => {
    expect(
      draftRequest(
        { store: "APP_STORE", localization: "en-US" },
        { ...live, title: "Habit Tracker" },
        live,
      ),
    ).toEqual({ localization: "en-US", title: "Habit Tracker" });
  });

  it("names the country on Google Play", () => {
    expect(
      draftRequest(
        { store: "GOOGLE_PLAY", country: "us" },
        { title: "Habit", shortDescription: "Track it", description: "" },
        { title: "Focus", shortDescription: "Track it", description: "" },
      ),
    ).toEqual({ country: "us", title: "Habit" });
  });

  it("answers null when nothing changed", () => {
    expect(
      draftRequest({ store: "APP_STORE", localization: "en-US" }, live, live),
    ).toBeNull();
  });
});
