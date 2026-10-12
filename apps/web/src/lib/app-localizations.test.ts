import { describe, expect, it } from "vitest";
import {
  keywordFieldChars,
  type AppLocalizationItem,
  type AppLocalizationOrigin,
  type AppLocalizationsResult,
  type AppStoreLocalization,
  type LocalizationReader,
  type LocalizationReadRole,
  type LocalizedKeywordFieldResult,
} from "@asobeast/shared";
import {
  editLocalizationHref,
  keywordFieldDraft,
  localizationMatrix,
  openLocalization,
  readingStorefrontNames,
  savedDescription,
  upsertLocalization,
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
