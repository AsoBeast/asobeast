import type { ListingTargetItem, ListingTargetsResult } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import {
  isEdited,
  missingMarkets,
  notTrackedLines,
  notTrackedSentence,
  moveSlot,
  openCandidates,
  readersLine,
  roleSlotsFilled,
  saveRequestOf,
  savedSentence,
  savedSlots,
  slotHolding,
  slotLabel,
  targetPhrase,
  withSlot,
  withoutSlot,
  withTopThree,
  untrackedLine,
  type TargetSlots,
} from "./listing-targets";

const EMPTY: TargetSlots = Array<null>(10).fill(null);

const item = (
  text: string,
  index: number,
  trackedIn: string[] = [],
): ListingTargetItem => ({
  position: index + 1,
  role: index === 0 ? "title" : index < 3 ? "subtitle" : "extra",
  text,
  trackedIn: trackedIn.map((country) => ({
    country,
    keywordId: `${country}:${text}`,
    active: true,
  })),
  untrackedIn: [],
  lead: null,
});

const result = (slots: (ListingTargetItem | null)[]): ListingTargetsResult => ({
  appId: "app-1",
  localization: "en-US",
  readers: ["us"],
  slots: [...slots, ...Array<null>(10 - slots.length).fill(null)],
  candidates: [],
  updatedAt: null,
});

describe("slot edits", () => {
  it("puts a phrase in a slot and removes it from the candidates", () => {
    const slots = withSlot(EMPTY, 0, "habit tracker");
    const lead = {
      country: "us",
      keywordId: "kw",
      popularity: 40,
      difficulty: 30,
      opportunity: 50,
      relevance: 80,
      position: 4,
      depth: 200,
      checkedOn: "2026-11-25",
    };

    expect(slots[0]).toBe("habit tracker");
    expect(
      openCandidates(
        [
          { text: "habit tracker", markets: ["us"], lead },
          { text: "focus timer", markets: ["us"], lead },
        ],
        slots,
      ).map(({ text }) => text),
    ).toEqual(["focus timer"]);
  });

  it("clears a slot without moving the others", () => {
    const slots = withoutSlot(["a", "b", "c", ...EMPTY.slice(3)], 1);

    expect(slots.slice(0, 3)).toEqual(["a", null, "c"]);
  });

  it("answers the save request with null for empty slots", () => {
    expect(saveRequestOf(withSlot(EMPTY, 2, "c")).slots).toEqual([
      null,
      null,
      "c",
      ...EMPTY.slice(3),
    ]);
    expect(saveRequestOf(EMPTY, true)).toMatchObject({ trackMissing: true });
    expect(saveRequestOf(EMPTY)).not.toHaveProperty("trackMissing");
  });

  it("tells an edited list from the saved one", () => {
    const saved = savedSlots(result([item("a", 0)]));

    expect(isEdited(saved, saved)).toBe(false);
    expect(isEdited(withSlot(saved, 1, "b"), saved)).toBe(true);
  });

  it("refuses a phrase already in another slot", () => {
    const slots = withSlot(EMPTY, 2, "focus timer");

    expect(slotHolding(slots, "focus timer")).toBe(2);
    expect(slotHolding(slots, "habit")).toBeNull();
    expect(slotLabel(slotHolding(slots, "focus timer") ?? 0)).toBe("Subtitle");
  });
});

describe("slotLabel", () => {
  it("names the role slots and numbers the rest", () => {
    expect([0, 1, 2, 3, 9].map(slotLabel)).toEqual([
      "Title",
      "Subtitle",
      "Subtitle",
      "Keyword 4",
      "Keyword 10",
    ]);
  });
});

describe("targetPhrase", () => {
  it("normalizes a typed phrase like the server", () => {
    expect(targetPhrase("  Sleep   Sounds ")).toBe("sleep sounds");
  });

  it("refuses an empty or overlong phrase", () => {
    expect(targetPhrase("  ")).toBeNull();
    expect(targetPhrase("x".repeat(101))).toBeNull();
  });
});

describe("readersLine", () => {
  it("names the markets that read the localization", () => {
    expect(readersLine(["us", "gb"])).toBe(
      "Tracked in United States and United Kingdom",
    );
    expect(readersLine([])).toBe(
      "No market you track reads this localization yet",
    );
  });
});

describe("savedSentence", () => {
  it("names the one phrase a save started tracking and where", () => {
    expect(
      savedSentence(
        result([item("habit", 0, ["us"])]),
        result([item("habit", 0, ["us"]), item("sleep sounds", 1, ["us"])]),
      ),
    ).toBe("Targets saved. sleep sounds is now tracked in United States.");
  });

  it("counts several phrases and says nothing more when none started", () => {
    expect(
      savedSentence(
        undefined,
        result([item("a", 0, ["us"]), item("b", 1, ["us"])]),
      ),
    ).toBe("Targets saved. 2 keywords are now tracked.");
    expect(
      savedSentence(
        result([item("a", 0, ["us"])]),
        result([item("a", 1, ["us"])]),
      ),
    ).toBe("Targets saved.");
  });
});

const candidate = (text: string) => ({
  text,
  markets: ["us"],
  lead: {
    country: "us",
    keywordId: text,
    popularity: 40,
    difficulty: 30,
    opportunity: 50,
    relevance: 80,
    position: null,
    depth: null,
    checkedOn: null,
  },
});

describe("withTopThree", () => {
  it("fills the three role slots with the first three candidates", () => {
    expect(
      withTopThree(EMPTY, ["a", "b", "c", "d"].map(candidate)).slice(0, 4),
    ).toEqual(["a", "b", "c", null]);
  });

  it("keeps a role slot the viewer already filled and fills the others in order", () => {
    expect(
      withTopThree(withSlot(EMPTY, 1, "mine"), ["a", "b"].map(candidate)).slice(
        0,
        3,
      ),
    ).toEqual(["a", "mine", "b"]);
  });

  it("fills what it can when fewer than three candidates exist", () => {
    expect(withTopThree(EMPTY, [candidate("a")]).slice(0, 3)).toEqual([
      "a",
      null,
      null,
    ]);
  });

  it("never puts a phrase twice", () => {
    const slots = withSlot(EMPTY, 5, "a");

    expect(withTopThree(slots, ["a", "b"].map(candidate)).slice(0, 3)).toEqual([
      "b",
      null,
      null,
    ]);
  });

  it("knows when the role slots are full", () => {
    expect(roleSlotsFilled(EMPTY)).toBe(false);
    expect(roleSlotsFilled(["a", "b", "c", ...EMPTY.slice(3)])).toBe(true);
  });
});

describe("moveSlot", () => {
  it("swaps a slot with the one above", () => {
    expect(moveSlot(["a", "b", ...EMPTY.slice(2)], 1, 0).slice(0, 2)).toEqual([
      "b",
      "a",
    ]);
  });

  it("moves into an empty slot without shifting the rest", () => {
    expect(
      moveSlot(["a", null, "c", ...EMPTY.slice(3)], 0, 1).slice(0, 3),
    ).toEqual([null, "a", "c"]);
  });

  it("does nothing at the top or the bottom", () => {
    const slots = ["a", ...EMPTY.slice(1)];

    expect(moveSlot(slots, 0, -1)).toBe(slots);
    expect(moveSlot(slots, 9, 10)).toBe(slots);
  });
});

describe("notTrackedSentence", () => {
  it("names the phrases the keyword limit left out and where", () => {
    expect(
      notTrackedSentence([
        { text: "sleep sounds", country: "gb", reason: "keywordLimit" },
      ]),
    ).toBe(
      "sleep sounds was not tracked in United Kingdom: your plan's keyword limit is reached.",
    );
  });

  it("groups several", () => {
    const notTracked = [
      { text: "a", country: "gb", reason: "keywordLimit" as const },
      { text: "a", country: "au", reason: "keywordLimit" as const },
      { text: "b", country: "gb", reason: "keywordLimit" as const },
    ];

    expect(notTrackedSentence(notTracked)).toBe(
      "2 keywords were not tracked: your plan's keyword limit is reached.",
    );
    expect(notTrackedLines(notTracked)).toEqual([
      "a in United Kingdom and Australia",
      "b in United Kingdom",
    ]);
  });

  it("says nothing when everything was tracked", () => {
    expect(notTrackedSentence([])).toBeNull();
  });
});

describe("missingMarkets", () => {
  it("lists each reader some slot is not tracked in once, in reader order", () => {
    const missing = (text: string, untrackedIn: string[]) => ({
      ...item(text, 0),
      untrackedIn,
    });

    expect(
      missingMarkets({
        ...result([missing("a", ["gb"]), missing("b", ["au", "gb"])]),
        readers: ["us", "au", "gb"],
      }),
    ).toEqual(["au", "gb"]);
    expect(untrackedLine(["gb"])).toBe("Not tracked in United Kingdom");
    expect(untrackedLine([])).toBeNull();
  });
});
