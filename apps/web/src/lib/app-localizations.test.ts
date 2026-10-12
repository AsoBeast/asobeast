import { describe, expect, it } from "vitest";
import {
  keywordFieldChars,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type KeywordFieldMarketPreview,
  type KeywordFieldSavePreview,
  type LocalizationReader,
  type LocalizationReadRole,
  type LocalizedKeywordFieldResult,
} from "@asobeast/shared";
import {
  addableGroups,
  addedSentence,
  droppedSentence,
  editLocalizationHref,
  keywordFieldDraft,
  localizationMatrix,
  openLocalization,
  readingStorefrontNames,
  removeDescription,
  saveCostText,
  savedDescription,
  saveQuotaNotice,
  selectedCost,
  shouldConfirmSave,
  tracksNewPhrases,
  upsertLocalization,
  withoutLocalization,
} from "./app-localizations";

const reader = (
  country: string,
  role: LocalizationReadRole,
  home = false,
): LocalizationReader => ({ country, role, home });

function item(
  localization: AppStoreLocalization,
  origin: AppLocalizationOrigin,
  readBy: LocalizationReader[],
  phrases: string[] = [],
): AppLocalizationItem {
  return {
    localization,
    origin,
    phrases,
    charactersUsed: keywordFieldChars(phrases),
    charactersLimit: 100,
    readBy,
    updatedAt: null,
  };
}

const market = (
  country: string,
  role: LocalizationReadRole,
  newPhrases: string[],
  home = false,
): KeywordFieldMarketPreview => ({
  country,
  role,
  home,
  newPhrases,
  keywordMarkets: newPhrases.length,
  dailyRequests: newPhrases.length,
});

const preview = (
  patch: Partial<KeywordFieldSavePreview>,
): KeywordFieldSavePreview => ({
  localization: "es-MX",
  phrases: [],
  added: [],
  dropped: [],
  duplicatesRemoved: 0,
  charactersUsed: 0,
  charactersLimit: 100,
  markets: [],
  quota: null,
  ...patch,
});

const US = market("us", "additional", [], true);
const MX = market("mx", "default", []);

const RESULT: AppLocalizationsResult = {
  home: "us",
  markets: ["us", "mx"],
  localizations: [
    item("en-US", "home", [reader("us", "default", true)]),
    item("es-MX", "manual", [
      reader("us", "additional", true),
      reader("mx", "default"),
    ]),
  ],
};

const saved = (
  phrases: string[],
  trackedIn: string[],
  duplicatesRemoved = 0,
): LocalizedKeywordFieldResult => ({
  localization: item("es-MX", "manual", [], phrases),
  duplicatesRemoved,
  trackedIn,
});

describe("localizationMatrix", () => {
  it("W-LOC-01 has no matrix for one market and one localization", () => {
    expect(
      localizationMatrix({
        home: "us",
        markets: ["us"],
        localizations: [RESULT.localizations[0]],
      }),
    ).toBeNull();
  });

  it("W-LOC-02 lays one row per localization and one cell per market", () => {
    expect(localizationMatrix(RESULT)).toEqual({
      markets: ["us", "mx"],
      rows: [
        { localization: "en-US", origin: "home", cells: ["default", null] },
        {
          localization: "es-MX",
          origin: "manual",
          cells: ["additional", "default"],
        },
      ],
    });
  });

  it("W-LOC-03 keeps the matrix for two markets and one localization", () => {
    const grid = localizationMatrix({
      ...RESULT,
      localizations: [RESULT.localizations[0]],
    });

    expect(grid?.rows).toEqual([
      { localization: "en-US", origin: "home", cells: ["default", null] },
    ]);
  });

  it("W-LOC-04 keeps the matrix for one market and two localizations", () => {
    const grid = localizationMatrix({ ...RESULT, markets: ["us"] });

    expect(grid?.rows.map((row) => row.cells.length)).toEqual([1, 1]);
  });
});

describe("openLocalization", () => {
  it("W-LOC-05 opens the requested localization when the app ships it", () => {
    expect(openLocalization(RESULT.localizations, "es-MX")).toBe("es-MX");
  });

  it("W-LOC-06 leaves every item closed for a localization the app does not ship", () => {
    expect(openLocalization(RESULT.localizations, "ja")).toBe("");
    expect(openLocalization(RESULT.localizations, null)).toBe("");
  });

  it("W-LOC-07 opens the only localization whatever was requested", () => {
    const only = [RESULT.localizations[0]];

    expect(openLocalization(only, null)).toBe("en-US");
    expect(openLocalization(only, "ja")).toBe("en-US");
  });
});

describe("keywordFieldDraft", () => {
  it("W-LOC-08 counts letters such as ą once", () => {
    const draft = keywordFieldDraft(
      "geoguessr,geoguess,zgadywanka,stolice,miasto,lokalizacja,państwo,podróże,zabytki,odkrywca,kontynenty",
      [],
    );

    expect(draft.used).toBe(100);
    expect(draft.over).toBe(0);
  });

  it("W-LOC-09 counts what the api stores", () => {
    const repeated = keywordFieldDraft("a,".repeat(60), []);
    expect(repeated.phrases).toEqual(["a"]);
    expect(repeated.used).toBe(1);

    const spaced = keywordFieldDraft("fitness, workout, running", []);
    expect(spaced.used).toBe(23);
    expect(spaced.storedAs).toBe("fitness,workout,running");

    const cased = keywordFieldDraft("Fitness,FITNESS, fitness", []);
    expect(cased.used).toBe(7);
    expect(cased.storedAs).toBe("fitness");
  });

  it("W-LOC-10 says nothing about how it is stored when the text is already stored form", () => {
    expect(keywordFieldDraft("fitness,workout", []).storedAs).toBeNull();
    expect(keywordFieldDraft("", []).storedAs).toBeNull();
  });

  it("W-LOC-11 sees a change only in the phrases", () => {
    const stored = ["a", "b"];

    expect(keywordFieldDraft("A, B", stored).changed).toBe(false);
    expect(keywordFieldDraft("b,a", stored).changed).toBe(true);
    expect(keywordFieldDraft("a", stored).changed).toBe(true);
    expect(keywordFieldDraft("", stored).changed).toBe(true);
    expect(keywordFieldDraft("", []).changed).toBe(false);
  });
});

describe("savedDescription", () => {
  it("W-LOC-12 describes what a save tracked", () => {
    expect(savedDescription(saved([], []))).toBe("The field is empty.");
    expect(savedDescription(saved(["a", "b"], ["us", "mx"]))).toBe(
      "2 phrases tracked in United States and Mexico",
    );
    expect(savedDescription(saved(["a"], []))).toBe(
      "Its phrases are not tracked in any market",
    );
    expect(savedDescription(saved(["a"], ["mx"], 2))).toBe(
      "1 phrase tracked in Mexico · 2 duplicates removed",
    );
  });
});

describe("upsertLocalization", () => {
  it("W-LOC-13 replaces a saved item where it stood", () => {
    const next = upsertLocalization(
      RESULT,
      item("es-MX", "manual", RESULT.localizations[1].readBy, ["a"]),
    );

    expect(next.localizations.map((entry) => entry.localization)).toEqual([
      "en-US",
      "es-MX",
    ]);
    expect(next.localizations[1].phrases).toEqual(["a"]);
  });

  it("W-LOC-14 inserts a new item by name, the home one first", () => {
    const before = structuredClone(RESULT);

    const next = upsertLocalization(
      upsertLocalization(RESULT, item("en-GB", "manual", [])),
      item("pl", "detected", []),
    );

    expect(next.localizations.map((entry) => entry.localization)).toEqual([
      "en-US",
      "en-GB",
      "pl",
      "es-MX",
    ]);
    expect(RESULT).toEqual(before);
  });
});

describe("readingStorefrontNames", () => {
  it("W-LOC-15 names the storefronts that read a localization", () => {
    expect(readingStorefrontNames("vi")).toEqual(["United States", "Vietnam"]);
    expect(readingStorefrontNames("en-GB")).toHaveLength(5);
    expect(readingStorefrontNames("ja")).toEqual(["Japan"]);
  });
});

describe("editLocalizationHref", () => {
  it("W-LNK-01 links a localization to its item on the metadata page", () => {
    expect(editLocalizationHref("app-1", "es-MX")).toBe(
      "/apps/app-1/metadata?fieldLocale=es-MX#app-localizations",
    );
  });
});

describe("the save review", () => {
  const costly = preview({
    markets: [
      market("us", "additional", ["a", "b"], true),
      market("mx", "default", ["a"]),
    ],
  });

  it("W-SAV-01 saves straight away when nothing is added, dropped or newly tracked", () => {
    expect(shouldConfirmSave(preview({ markets: [US, MX] }))).toBe(false);
  });

  it("W-SAV-02 asks when a phrase is added", () => {
    expect(shouldConfirmSave(preview({ added: ["a"] }))).toBe(true);
  });

  it("W-SAV-03 asks when a phrase is dropped", () => {
    expect(shouldConfirmSave(preview({ dropped: ["a"] }))).toBe(true);
  });

  it("W-SAV-04 asks when a market would track a phrase it does not track yet", () => {
    expect(
      shouldConfirmSave(
        preview({ markets: [market("us", "additional", ["a"], true), MX] }),
      ),
    ).toBe(true);
  });

  it("W-SAV-05 sums the cost of the ticked markets only", () => {
    expect(selectedCost(costly, ["us", "mx"])).toEqual({
      keywordMarkets: 3,
      dailyRequests: 3,
    });
    expect(selectedCost(costly, ["mx"])).toEqual({
      keywordMarkets: 1,
      dailyRequests: 1,
    });
  });

  it("W-SAV-06 costs nothing when no market is ticked", () => {
    expect(selectedCost(costly, [])).toEqual({
      keywordMarkets: 0,
      dailyRequests: 0,
    });
  });

  it("W-SAV-07 words the cost", () => {
    expect(saveCostText({ keywordMarkets: 2, dailyRequests: 2 })).toBe(
      "Adds 2 keyword markets and about 2 store requests a day.",
    );
    expect(saveCostText({ keywordMarkets: 1, dailyRequests: 1 })).toBe(
      "Adds 1 keyword market and about 1 store request a day.",
    );
    expect(saveCostText({ keywordMarkets: 0, dailyRequests: 0 })).toBe(
      "Tracks nothing new.",
    );
  });

  it.each([
    [null, 4, null],
    [
      { used: 6, limit: 10, upgradeTo: "ultimate" as const },
      4,
      {
        text: "10 of 10 keyword markets after saving.",
        over: false,
        upgrade: false,
      },
    ],
    [
      { used: 6, limit: 10, upgradeTo: "ultimate" as const },
      5,
      {
        text: "11 of 10 keyword markets after saving.",
        over: true,
        upgrade: true,
      },
    ],
    [
      { used: 6, limit: 10, upgradeTo: null },
      5,
      {
        text: "11 of 10 keyword markets after saving.",
        over: true,
        upgrade: false,
      },
    ],
    [
      { used: 0, limit: 0, upgradeTo: "indie" as const },
      1,
      {
        text: "Your plan includes no keyword markets.",
        over: true,
        upgrade: true,
      },
    ],
    [
      { used: 0, limit: 0, upgradeTo: "indie" as const },
      0,
      {
        text: "Your plan includes no keyword markets.",
        over: false,
        upgrade: false,
      },
    ],
  ])(
    "W-SAV-08 words the plan quota after the save (%j, %d)",
    (quota, keywordMarkets, expected) => {
      expect(
        saveQuotaNotice(quota, {
          keywordMarkets,
          dailyRequests: keywordMarkets,
        }),
      ).toEqual(expected);
    },
  );

  it("W-SAV-09 scores new keywords only when a ticked market tracks a new phrase", () => {
    expect(tracksNewPhrases(costly, ["us"])).toBe(true);
    expect(tracksNewPhrases(costly, [])).toBe(false);
    expect(tracksNewPhrases(preview({ markets: [US, MX] }), ["us", "mx"])).toBe(
      false,
    );
  });

  it("W-SAV-10 words what is added and what leaves the field", () => {
    expect(addedSentence(preview({ added: ["a", "b"] }))).toBe(
      "2 new phrases: a, b",
    );
    expect(addedSentence(preview({ added: ["a"] }))).toBe("1 new phrase: a");
    expect(addedSentence(preview({}))).toBeNull();
    expect(
      droppedSentence(preview({ dropped: ["a", "b"], markets: [US, MX] })),
    ).toBe(
      "2 phrases leave the field and stop being tracked as keyword field phrases in United States and Mexico",
    );
    expect(
      droppedSentence(preview({ dropped: ["a"], markets: [US, MX] })),
    ).toBe(
      "1 phrase leaves the field and stops being tracked as a keyword field phrase in United States and Mexico",
    );
    expect(droppedSentence(preview({ markets: [US, MX] }))).toBeNull();
  });
});

describe("adding and removing", () => {
  const home = [item("en-US", "home", [reader("us", "default", true)])];
  const tagsOf = (entries: { localization: string }[]) =>
    entries.map((entry) => entry.localization);

  it("W-ADD-01 groups the languages your markets read apart from the rest", () => {
    const groups = addableGroups(home, ["us", "mx"]);

    expect(groups.read).toContainEqual({
      localization: "es-MX",
      readIn: ["us", "mx"],
    });
    expect(groups.read).toContainEqual({
      localization: "en-GB",
      readIn: ["mx"],
    });
    expect(groups.read).toContainEqual({ localization: "ar", readIn: ["us"] });
    expect(groups.other).toContainEqual({ localization: "ja", readIn: [] });
    expect(groups.other.every((entry) => entry.readIn.length === 0)).toBe(true);
  });

  it("W-ADD-02 leaves out every shipped localization", () => {
    const groups = addableGroups(home, ["us", "mx"]);
    expect(tagsOf([...groups.read, ...groups.other])).not.toContain("en-US");

    const withSpanish = addableGroups(
      [...home, item("es-MX", "manual", [])],
      ["us", "mx"],
    );
    expect(tagsOf([...withSpanish.read, ...withSpanish.other])).not.toContain(
      "es-MX",
    );
  });

  it("W-ADD-03 keeps the alphabetical order of the localization list inside each group", () => {
    expect(tagsOf(addableGroups(home, ["us", "mx"]).read)).toEqual([
      "ar",
      "zh-Hans",
      "zh-Hant",
      "en-GB",
      "fr",
      "ko",
      "pt-BR",
      "ru",
      "es-MX",
      "vi",
    ]);
  });

  it("W-ADD-04 offers everything but the shipped ones when no market reads them", () => {
    const groups = addableGroups(home, []);

    expect(groups.read).toEqual([]);
    expect(groups.other).toHaveLength(49);
  });

  it("W-ADD-05 removes an item and keeps the order of the rest", () => {
    expect(tagsOf(withoutLocalization(RESULT, "es-MX").localizations)).toEqual([
      "en-US",
    ]);
    expect(withoutLocalization(RESULT, "fr")).toEqual(RESULT);
  });

  it("W-ADD-06 says who stops tracking a removed field", () => {
    expect(
      removeDescription(
        item("es-MX", "manual", [
          reader("us", "additional", true),
          reader("mx", "default"),
        ]),
      ),
    ).toBe(
      "Its keyword field is deleted. Its phrases stop being tracked as keyword field phrases in United States and Mexico; phrases you track for another reason stay.",
    );
    expect(removeDescription(item("es-MX", "manual", []))).toBe(
      "Its keyword field is deleted. Phrases you track for another reason stay.",
    );
  });
});
