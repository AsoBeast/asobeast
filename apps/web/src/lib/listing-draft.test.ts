import { describe, expect, it } from "vitest";
import {
  changedFields,
  draftFieldsOf,
  draftRequest,
  draftScopeOf,
  draftValues,
  fieldCount,
  listingDraftKey,
  liveDraftValues,
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

describe("fieldCount", () => {
  it("counts code points against the store limit", () => {
    expect(fieldCount("APP_STORE", "title", "Focus ⏱ Timer")).toEqual({
      used: 13,
      limit: 30,
      over: 0,
      text: "13/30",
    });
  });

  it("says how far a field runs over", () => {
    expect(
      fieldCount("GOOGLE_PLAY", "shortDescription", "a".repeat(85)),
    ).toEqual({
      used: 85,
      limit: 80,
      over: 5,
      text: "85/80 · 5 over",
    });
  });
});

describe("draftScopeOf", () => {
  it("drafts the localization on screen, else the market's default one", () => {
    expect(draftScopeOf("APP_STORE", "pl", "pl")).toEqual({
      store: "APP_STORE",
      localization: "pl",
    });
    expect(draftScopeOf("APP_STORE", "us", undefined)).toEqual({
      store: "APP_STORE",
      localization: "en-US",
    });
  });

  it("drafts the market on Google Play", () => {
    expect(draftScopeOf("GOOGLE_PLAY", "de", undefined)).toEqual({
      store: "GOOGLE_PLAY",
      country: "de",
    });
  });
});

describe("liveDraftValues", () => {
  it("reads the live value of every draft field, empty when the audit has none", () => {
    expect(
      liveDraftValues({
        store: "APP_STORE",
        fields: [
          {
            field: "title",
            value: "Focus Timer",
            chars: 11,
            limit: 30,
            indexed: true,
            issues: [],
          },
          {
            field: "subtitle",
            value: null,
            chars: 0,
            limit: 30,
            indexed: true,
            issues: [],
          },
        ],
      }),
    ).toEqual({
      title: "Focus Timer",
      subtitle: "",
      keywordField: "",
      description: "",
    });
  });
});
