import { TRACKED_KEYWORD_CHAR_LIMIT } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  buildCombinations,
  combinationKey,
  COMBINATION_LIMIT,
  COMBINATION_MIN_WORD_LENGTH,
  listingWords,
  type CombinationListing,
  type TrackedPhrase,
} from "./keyword-combinations";

const MOOD: CombinationListing = {
  store: "APP_STORE",
  snapshot: {
    title: "Mood Journal: Daily Diary",
    subtitle: "Gratitude log & sleep notes",
    summary: "Write a short entry every evening.",
  },
  keywordField: ["mood tracker", "daily planner", "water"],
};

const WORDS = Array.from(
  { length: 23 },
  (_, index) => `word${String.fromCharCode(97 + index)}`,
);

function titled(title: string): CombinationListing {
  return {
    store: "APP_STORE",
    snapshot: { title, subtitle: null, summary: null },
    keywordField: [],
  };
}

function combine(listing: CombinationListing, rows: TrackedPhrase[] = []) {
  return buildCombinations({ listing, tracked: rows, market: "us" });
}

function phrasesOf(listing: CombinationListing): string[] {
  return combine(listing).combinations.map((combination) => combination.phrase);
}

function textsOf(listing: CombinationListing): string[] {
  return listingWords(listing).map((word) => word.text);
}

describe("listingWords", () => {
  it("reads the title, subtitle and keyword field of an App Store listing, in that order", () => {
    expect(listingWords(MOOD)).toEqual([
      { text: "mood", fields: ["title", "keywordField"] },
      { text: "journal", fields: ["title"] },
      { text: "daily", fields: ["title", "keywordField"] },
      { text: "diary", fields: ["title"] },
      { text: "gratitude", fields: ["subtitle"] },
      { text: "log", fields: ["subtitle"] },
      { text: "sleep", fields: ["subtitle"] },
      { text: "notes", fields: ["subtitle"] },
      { text: "tracker", fields: ["keywordField"] },
      { text: "planner", fields: ["keywordField"] },
      { text: "water", fields: ["keywordField"] },
    ]);
  });

  it("leaves out stopwords, including app, free, best, new, official, get and download", () => {
    expect(
      textsOf(
        titled("The Best Free App for Official New Habits: Get, Download"),
      ),
    ).toEqual(["habits"]);
  });

  it(`leaves out words shorter than ${COMBINATION_MIN_WORD_LENGTH} characters`, () => {
    expect(textsOf(titled("B 3D x Go 2 Scan"))).toEqual(["3d", "go", "scan"]);
  });

  it("splits a keyword field entry of several words into its words", () => {
    const listing = {
      ...titled("Tracker"),
      keywordField: ["water intake log"],
    };
    expect(listingWords(listing)).toEqual([
      { text: "tracker", fields: ["title"] },
      { text: "water", fields: ["keywordField"] },
      { text: "intake", fields: ["keywordField"] },
      { text: "log", fields: ["keywordField"] },
    ]);
  });

  it("keeps a repeated word once, where it first appears, with every field it appears in", () => {
    const listing: CombinationListing = {
      store: "APP_STORE",
      snapshot: {
        title: "Timer Focus",
        subtitle: "focus TIMER study",
        summary: null,
      },
      keywordField: ["study", "timer"],
    };
    expect(listingWords(listing)).toEqual([
      { text: "timer", fields: ["title", "subtitle", "keywordField"] },
      { text: "focus", fields: ["title", "subtitle"] },
      { text: "study", fields: ["subtitle", "keywordField"] },
    ]);
  });

  it("reads only the title and short description of a Google Play listing", () => {
    const listing: CombinationListing = {
      store: "GOOGLE_PLAY",
      snapshot: {
        title: "Tomato Clock",
        subtitle: "Ignored subtitle",
        summary: "Fokus Timer für Pomodoro",
      },
      keywordField: ["ignored field"],
    };
    expect(listingWords(listing)).toEqual([
      { text: "tomato", fields: ["title"] },
      { text: "clock", fields: ["title"] },
      { text: "fokus", fields: ["shortDescription"] },
      { text: "timer", fields: ["shortDescription"] },
      { text: "für", fields: ["shortDescription"] },
      { text: "pomodoro", fields: ["shortDescription"] },
    ]);
  });

  it("keeps accented and non Latin words whole and composes decomposed input", () => {
    const listing: CombinationListing = {
      store: "APP_STORE",
      snapshot: {
        title: "Zażółć Gęślą",
        subtitle: "Трекер привычек",
        summary: null,
      },
      keywordField: ["Zażółć".normalize("NFD"), "習慣トラッカー 毎日"],
    };
    expect(listingWords(listing)[0]).toEqual({
      text: "zażółć",
      fields: ["title", "keywordField"],
    });
    expect(textsOf(listing)).toEqual([
      "zażółć",
      "gęślą",
      "трекер",
      "привычек",
      "習慣トラッカー",
      "毎日",
    ]);
  });
});

describe("buildCombinations", () => {
  it.each([0, 1, 2, 3, 4, 5, 10, 20])(
    "forms n + C(n,2) + C(n,3) phrases from %i words",
    (count) => {
      const result = combine(titled(WORDS.slice(0, count).join(" ")));
      const pairs = (count * (count - 1)) / 2;
      const triples = (pairs * (count - 2)) / 3;
      expect(result.total).toBe(count + pairs + triples);
      expect(result.combinations).toHaveLength(count + pairs + triples);
      expect(result.truncated).toBe(false);
    },
  );

  it(`stops at ${COMBINATION_LIMIT} phrases, shortest first, and says so`, () => {
    const result = combine(titled(WORDS.join(" ")));
    expect(result.total).toBe(2047);
    expect(result.combinations).toHaveLength(COMBINATION_LIMIT);
    expect(result.truncated).toBe(true);
    expect(result.combinations[275].phrase).toBe("wordv wordw");
    expect(result.combinations[276].phrase).toBe("worda wordb wordc");
    expect(result.combinations.at(-1)?.phrase).toBe("wordp wordr wordu");
  });

  it("orders phrases by word count, then by where their words first appear", () => {
    expect(phrasesOf(titled("wa wb wc wd"))).toEqual([
      "wa",
      "wb",
      "wc",
      "wd",
      "wa wb",
      "wa wc",
      "wa wd",
      "wb wc",
      "wb wd",
      "wc wd",
      "wa wb wc",
      "wa wb wd",
      "wa wc wd",
      "wb wc wd",
    ]);
  });

  it("names the fields a phrase's words come from, in field order", () => {
    const fields = new Map(
      combine(MOOD).combinations.map((row) => [row.phrase, row.fields]),
    );
    expect(fields.get("mood tracker")).toEqual(["title", "keywordField"]);
    expect(fields.get("journal gratitude water")).toEqual([
      "title",
      "subtitle",
      "keywordField",
    ]);
  });

  it(`leaves out a phrase longer than ${TRACKED_KEYWORD_CHAR_LIMIT} characters, which the API refuses`, () => {
    const words = ["x".repeat(60), "y".repeat(45)];
    const result = combine({
      store: "APP_STORE",
      snapshot: null,
      keywordField: words,
    });
    expect(result.combinations.map((row) => row.phrase)).toEqual(words);
    expect(result.total).toBe(2);
  });

  it("forms nothing from an empty listing", () => {
    const empty: CombinationListing = {
      store: "APP_STORE",
      snapshot: null,
      keywordField: [],
    };
    const mood: TrackedPhrase = { text: "mood", active: true, country: "us" };
    expect(combine(empty, [mood])).toEqual({
      words: [],
      combinations: [],
      total: 0,
      truncated: false,
    });
    expect(phrasesOf(titled("The App for You"))).toEqual([]);
  });

  it("reads the keyword field before any snapshot exists", () => {
    expect(
      phrasesOf({
        store: "APP_STORE",
        snapshot: null,
        keywordField: ["water"],
      }),
    ).toEqual(["water"]);
  });
});

describe("combinationKey", () => {
  it("ignores word order, repeats, case and stopwords, and does not stem", () => {
    expect(combinationKey("timer pomodoro")).toBe("pomodoro timer");
    expect(combinationKey("Pomodoro  TIMER timer")).toBe("pomodoro timer");
    expect(combinationKey("mood journal app")).toBe("journal mood");
    expect(combinationKey("habits")).not.toBe(combinationKey("habit"));
    expect(combinationKey("the best app")).toBe("");
  });
});

describe("tracking status", () => {
  const ROWS: TrackedPhrase[] = [
    { text: "journal mood", active: true, country: "us" },
    { text: "sleep notes app", active: true, country: "us" },
    { text: "gratitude", active: false, country: "us" },
    { text: "daily planner", active: false, country: "us" },
    { text: "planner daily", active: true, country: "us" },
    { text: "diary", active: true, country: "gb" },
    { text: "moods", active: true, country: "us" },
  ];

  it.each([
    ["mood journal", "tracked", "journal mood"],
    ["sleep notes", "tracked", "sleep notes app"],
    ["gratitude", "paused", "gratitude"],
    ["daily planner", "tracked", "planner daily"],
    ["diary", "untracked", null],
    ["mood", "untracked", null],
  ] as const)("marks %s %s", (phrase, status, trackedAs) => {
    const row = combine(MOOD, ROWS).combinations.find(
      (combination) => combination.phrase === phrase,
    );
    expect([row?.status, row?.trackedAs]).toEqual([status, trackedAs]);
  });
});
