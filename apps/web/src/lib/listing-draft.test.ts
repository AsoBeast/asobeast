import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoveragePreviewKeyword } from "@asobeast/shared";
import {
  adoptHomeDraft,
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
      "promotionalText",
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

describe("promotional text", () => {
  it("keeps promotional text in the draft on the App Store only", () => {
    expect(draftFieldsOf("APP_STORE")).toContain("promotionalText");
    expect(draftFieldsOf("GOOGLE_PLAY")).not.toContain("promotionalText");
  });

  it("reads promotional text from a stored draft", () => {
    expect(
      parseListingDraft('{"v":1,"promotionalText":"New: focus streaks"}'),
    ).toEqual({ promotionalText: "New: focus streaks" });
  });

  it("never sends promotional text to the coverage preview", () => {
    expect(
      draftRequest(
        { store: "APP_STORE", localization: "en-US" },
        { ...live, title: "Habit Tracker", promotionalText: "New streaks" },
        live,
      ),
    ).not.toHaveProperty("promotionalText");
  });

  it("asks for no coverage when only promotional text changed", () => {
    expect(
      draftRequest(
        { store: "APP_STORE", localization: "en-US" },
        { ...live, promotionalText: "New streaks" },
        live,
      ),
    ).toBeNull();
  });

  it("copies promotional text under its App Store Connect name", () => {
    expect(
      consoleCopy("APP_STORE", {
        title: "Habit Tracker",
        promotionalText: "New streaks",
      }),
    ).toBe("Name\nHabit Tracker\n\nPromotional Text\nNew streaks");
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

  it("drafts the native default of the home market", () => {
    const polish = { country: "pl", defaultLocalization: "pl" };

    expect(draftScopeOf("APP_STORE", "pl", undefined, polish)).toEqual({
      store: "APP_STORE",
      localization: "pl",
    });
    expect(draftScopeOf("APP_STORE", "pl", undefined)).toEqual({
      store: "APP_STORE",
      localization: "en-GB",
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
      promotionalText: "",
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

  it("moves a home draft saved under the storefront default to the native home", () => {
    const store = stubStorage({
      "asobeast.listingDraft.app-1.en-GB": '{"v":1,"title":"Dziennik"}',
    });

    adoptHomeDraft("app-1", { country: "pl", defaultLocalization: "pl" });

    expect(
      parseListingDraft(store.get("asobeast.listingDraft.app-1.pl") ?? null),
    ).toEqual({ title: "Dziennik" });
    expect(store.get("asobeast.listingDraft.app-1.en-GB")).toBe("");
  });

  it("never overwrites a draft of the native home", () => {
    const store = stubStorage({
      "asobeast.listingDraft.app-1.en-GB": '{"v":1,"title":"Old"}',
      "asobeast.listingDraft.app-1.pl": '{"v":1,"title":"New"}',
    });

    adoptHomeDraft("app-1", { country: "pl", defaultLocalization: "pl" });

    expect(
      parseListingDraft(store.get("asobeast.listingDraft.app-1.pl") ?? null),
    ).toEqual({ title: "New" });
    expect(store.get("asobeast.listingDraft.app-1.en-GB")).toBe(
      '{"v":1,"title":"Old"}',
    );
  });

  it("moves nothing for an app on its storefront default", () => {
    const store = stubStorage({
      "asobeast.listingDraft.app-1.en-GB": '{"v":1,"title":"Diary"}',
    });

    adoptHomeDraft("app-1", { country: "pl", defaultLocalization: null });

    expect([...store.keys()]).toEqual(["asobeast.listingDraft.app-1.en-GB"]);
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
    expect(isListingDraftField("whatsNew")).toBe(false);
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
    expect(draftView({ country: "us" }, null, markets)).toEqual({
      market: "us",
      localization: null,
    });
    expect(draftView({ country: "us" }, "en-US", markets)).toEqual({
      market: "us",
      localization: null,
    });
  });

  it("opens the market that captures the drafted localization", () => {
    expect(draftView({ country: "us" }, "pl", markets)).toEqual({
      market: "pl",
      localization: "pl",
    });
  });

  it("views a draft of the native default as the home listing", () => {
    const polish = { country: "pl", defaultLocalization: "pl" };
    const home = [{ country: "pl", home: true, capturedAt: "", tracked: true }];

    expect(draftView(polish, "pl", home)).toEqual({
      market: "pl",
      localization: null,
    });
    expect(draftView(polish, "en-GB", home)).toBeNull();
  });

  it("opens nothing for a localization no market captures", () => {
    expect(draftView({ country: "us" }, "es-MX", markets)).toBeNull();
  });
});
