import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoveragePreviewKeyword } from "@asobeast/shared";
import {
  changedFields,
  consoleCopy,
  draftFieldsOf,
  draftRequest,
  draftScopeOf,
  draftView,
  draftValues,
  fieldCount,
  isListingDraftField,
  listingDraftKey,
  liveDraftValues,
  marketNote,
  parseListingDraft,
  previewGroups,
  serializeListingDraft,
  wasteReason,
  writeListingDraftField,
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
  it("sends every field the draft shows with the localization on the App Store", () => {
    expect(
      draftRequest(
        { store: "APP_STORE", localization: "en-US" },
        { ...live, title: "Habit Tracker" },
        live,
      ),
    ).toEqual({
      localization: "en-US",
      title: "Habit Tracker",
      subtitle: "Pomodoro",
      keywordField: "",
      description: "",
    });
  });

  it("names the country on Google Play", () => {
    expect(
      draftRequest(
        { store: "GOOGLE_PLAY", country: "us" },
        { title: "Habit", shortDescription: "Track it", description: "" },
        { title: "Focus", shortDescription: "Track it", description: "" },
      ),
    ).toEqual({
      country: "us",
      title: "Habit",
      shortDescription: "Track it",
      description: "",
    });
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

const row = (
  text: string,
  change: CoveragePreviewKeyword["change"],
  country = "us",
): CoveragePreviewKeyword => {
  const verdict = { fields: [], covered: false, wordsSplit: false };
  return {
    keywordId: `kw-${text}-${country}`,
    text,
    country,
    bucket: null,
    live: verdict,
    draft: verdict,
    change,
  };
};

describe("previewGroups", () => {
  it("groups rows by change in reading order", () => {
    const { groups } = previewGroups({
      markets: ["us"],
      keywords: [
        row("a", "kept"),
        row("b", "gained"),
        row("c", "lost"),
        row("d", "missing"),
      ],
    });

    expect(Object.keys(groups)).toEqual(["lost", "gained", "missing", "kept"]);
    expect(groups.lost.map((entry) => entry.text)).toEqual(["c"]);
    expect(groups.kept.map((entry) => entry.text)).toEqual(["a"]);
  });

  it("counts a keyword once per market", () => {
    const { groups, showCountry } = previewGroups({
      markets: ["us", "gb"],
      keywords: [row("habit", "gained"), row("habit", "gained", "gb")],
    });

    expect(groups.gained).toHaveLength(2);
    expect(showCountry).toBe(true);
    expect(previewGroups({ markets: ["us"], keywords: [] }).showCountry).toBe(
      false,
    );
  });

  it("reports no change when the draft equals the live listing", () => {
    const { groups } = previewGroups({
      markets: ["us"],
      keywords: [row("a", "kept"), row("b", "missing")],
    });

    expect(groups.lost).toEqual([]);
    expect(groups.gained).toEqual([]);
  });
});

describe("wasteReason", () => {
  it("names the fields that repeat a word", () => {
    expect(
      wasteReason({
        word: "habit",
        reason: "repeated",
        fields: ["title", "keywordField"],
      }),
    ).toBe("Repeated in title and keyword field");
  });

  it("says no tracked keyword uses an unused word", () => {
    expect(
      wasteReason({ word: "zen", reason: "unused", fields: ["subtitle"] }),
    ).toBe("No tracked keyword uses it");
  });
});

describe("marketNote", () => {
  it("says no market reads the localization", () => {
    expect(marketNote({ markets: [], waitingMarkets: [] })).toBe(
      "No market you track reads this localization yet.",
    );
  });

  it("names a market still judged on the home listing", () => {
    expect(marketNote({ markets: [], waitingMarkets: ["gb"] })).toBe(
      "United Kingdom is judged on your home listing until its own listing is captured, so no keyword is judged here yet.",
    );
    expect(marketNote({ markets: ["us"], waitingMarkets: ["gb", "de"] })).toBe(
      "United Kingdom and Germany are judged on your home listing until their own listings are captured.",
    );
  });

  it("says nothing when every reader is judged", () => {
    expect(marketNote({ markets: ["us"], waitingMarkets: [] })).toBeNull();
  });
});

describe("consoleCopy", () => {
  it("lists every drafted field under the name the App Store Connect form uses", () => {
    expect(
      consoleCopy("APP_STORE", {
        title: "Habit Tracker",
        subtitle: "Daily goals",
        keywordField: "habit,streak",
        description: "Build habits.",
      }),
    ).toBe(
      "Name\nHabit Tracker\n\nSubtitle\nDaily goals\n\nKeywords\nhabit,streak\n\nDescription\nBuild habits.",
    );
  });

  it("uses the Play Console names on Google Play", () => {
    expect(
      consoleCopy("GOOGLE_PLAY", {
        title: "Habit Tracker",
        shortDescription: "Build habits",
        description: "Every day.",
      }),
    ).toBe(
      "App name\nHabit Tracker\n\nShort description\nBuild habits\n\nFull description\nEvery day.",
    );
  });

  it("leaves out a field that is empty in the draft and on the store", () => {
    expect(
      consoleCopy("APP_STORE", {
        title: "Habit Tracker",
        subtitle: "",
        keywordField: "",
        description: "",
      }),
    ).toBe("Name\nHabit Tracker");
  });
});

describe("writeListingDraftField", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubStorage(initial: Record<string, string>) {
    const store = new Map(Object.entries(initial));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    });
    return store;
  }

  it("writes one assistant field into the stored draft", () => {
    const store = stubStorage({
      "asobeast.listingDraft.app-1.en-US": '{"v":1,"title":"Habit"}',
    });

    writeListingDraftField("app-1", "en-US", "subtitle", "Daily goals");

    expect(
      parseListingDraft(store.get("asobeast.listingDraft.app-1.en-US") ?? null),
    ).toEqual({ title: "Habit", subtitle: "Daily goals" });
  });

  it("writes the draft of a localization that is not on screen", () => {
    const store = stubStorage({});

    writeListingDraftField("app-1", "pl", "title", "Nawyki");

    expect(
      parseListingDraft(store.get("asobeast.listingDraft.app-1.pl") ?? null),
    ).toEqual({ title: "Nawyki" });
  });

  it("maps the assistant field names to draft fields", () => {
    expect(
      (
        [
          "title",
          "subtitle",
          "keywordField",
          "shortDescription",
          "description",
        ] as const
      ).every(isListingDraftField),
    ).toBe(true);
    expect(isListingDraftField("promotionalText")).toBe(false);
  });
});

describe("draftView", () => {
  const markets = [
    { country: "us", home: true, capturedAt: "", tracked: true },
    {
      country: "pl",
      home: false,
      capturedAt: "",
      tracked: true,
      localizations: ["pl"],
    },
  ];

  it("opens the home listing for a draft of its default localization", () => {
    expect(draftView("us", null, markets)).toEqual({
      market: "us",
      localization: null,
    });
    expect(draftView("us", "en-US", markets)).toEqual({
      market: "us",
      localization: null,
    });
  });

  it("opens the market that captures the drafted localization", () => {
    expect(draftView("us", "pl", markets)).toEqual({
      market: "pl",
      localization: "pl",
    });
  });

  it("opens nothing for a localization no market captures", () => {
    expect(draftView("us", "es-MX", markets)).toBeNull();
  });
});
