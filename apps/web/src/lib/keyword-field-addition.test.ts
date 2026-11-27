import { describe, expect, it } from "vitest";
import {
  keywordFieldChars,
  type AppLocalizationItem,
  type AppStoreLocalization,
  type MarketLocalizationRead,
} from "@asobeast/shared";
import { editLocalizationHref } from "./app-localizations";
import {
  additionNotice,
  additionOutcome,
  keywordFieldAddition,
  keywordFieldAdditionHref,
  keywordFieldTarget,
  proposalDraft,
  seededFieldDraft,
  proposedKeywordField,
  receivedAddition,
} from "./keyword-field-addition";

const listed = (
  localization: AppStoreLocalization,
  phrases: string[] = [],
): AppLocalizationItem => ({
  localization,
  origin: "home",
  phrases,
  charactersUsed: keywordFieldChars(phrases),
  charactersLimit: 100,
  readBy: [],
  updatedAt: null,
});

const localizations = (items: AppLocalizationItem[], storeManaged = false) => ({
  localizations: items,
  storeManaged,
});

describe("proposedKeywordField", () => {
  it("follows the stored phrases with the new ones", () => {
    expect(
      proposedKeywordField(["focus", "timer"], ["deep work", "pomodoro"]),
    ).toBe("focus,timer,deep work,pomodoro");
  });

  it("leaves out a phrase the field holds by now", () => {
    expect(
      proposedKeywordField(["focus", "deep work"], ["deep work", "pomodoro"]),
    ).toBe("focus,deep work,pomodoro");
  });

  it("answers the stored text when nothing is new", () => {
    expect(proposedKeywordField(["focus"], ["focus"])).toBe("focus");
    expect(proposedKeywordField([], [])).toBe("");
  });
});

describe("seededFieldDraft", () => {
  it("seeds the stored draft field as the unsaved text", () => {
    expect(
      seededFieldDraft(
        ["focus"],
        { fromDraft: "timer,focus", fieldAdd: null },
        false,
      ),
    ).toBe("timer,focus");
  });

  it("prefers the drafted field over added phrases", () => {
    expect(
      seededFieldDraft(
        ["focus"],
        { fromDraft: "timer", fieldAdd: ["deep work"] },
        false,
      ),
    ).toBe("timer");
  });

  it("seeds nothing when the draft equals the stored field", () => {
    expect(
      seededFieldDraft(
        ["timer", "focus"],
        { fromDraft: "Timer, focus", fieldAdd: null },
        false,
      ),
    ).toBeNull();
  });

  it("seeds nothing while the store manages the field", () => {
    expect(
      seededFieldDraft(
        ["focus"],
        { fromDraft: "timer", fieldAdd: ["deep work"] },
        true,
      ),
    ).toBeNull();
  });

  it("seeds nothing when the flag is set but no draft is stored", () => {
    expect(
      seededFieldDraft(
        ["focus"],
        { fromDraft: undefined, fieldAdd: null },
        false,
      ),
    ).toBeNull();
  });

  it("keeps the added phrases without a drafted field", () => {
    expect(
      seededFieldDraft(
        ["focus"],
        { fromDraft: undefined, fieldAdd: ["deep work"] },
        false,
      ),
    ).toBe("focus,deep work");
  });
});

describe("proposalDraft", () => {
  it("answers no draft without a proposal", () => {
    expect(proposalDraft(["focus"], null)).toBeNull();
  });

  it("answers no draft when every proposed phrase is stored", () => {
    expect(proposalDraft(["focus", "timer"], ["timer", "focus"])).toBeNull();
  });

  it("answers the stored phrases followed by the new ones", () => {
    expect(proposalDraft(["focus"], ["deep work"])).toBe("focus,deep work");
  });

  it("normalizes and deduplicates the received phrases", () => {
    expect(proposalDraft(["focus"], ["Timer", "timer ", "a,b"])).toBe(
      "focus,timer,a,b",
    );
  });
});

describe("keywordFieldAdditionHref", () => {
  const addition = (added: string[], held: string[] = [], leftOut = 0) => ({
    added,
    held,
    leftOut,
  });

  it("opens the localization's editor with the phrases", () => {
    expect(
      keywordFieldAdditionHref(
        "app-1",
        "en-US",
        addition(["focus timer", "deep work"]),
      ),
    ).toBe(
      "/apps/app-1/metadata?fieldLocale=en-US&fieldAdd=focus+timer,deep+work#app-localizations",
    );
  });

  it("carries the phrases the field holds and the count left out", () => {
    expect(
      keywordFieldAdditionHref(
        "app-1",
        "en-US",
        addition(["zen"], ["focus"], 2),
      ),
    ).toBe(
      "/apps/app-1/metadata?fieldLocale=en-US&fieldAdd=zen,focus&fieldLeftOut=2#app-localizations",
    );
    expect(
      keywordFieldAdditionHref("app-1", "en-US", addition([], [], 3)),
    ).toBe(
      "/apps/app-1/metadata?fieldLocale=en-US&fieldLeftOut=3#app-localizations",
    );
  });

  it("is the plain edit address when nothing is selected", () => {
    expect(keywordFieldAdditionHref("app-1", "en-US", addition([]))).toBe(
      editLocalizationHref("app-1", "en-US"),
    );
  });
});

describe("receivedAddition", () => {
  it("splits the received phrases into new and held against the stored field", () => {
    expect(
      receivedAddition(["focus", "timer"], ["timer", "deep work"], 1),
    ).toEqual({ added: ["deep work"], held: ["timer"], leftOut: 1 });
  });

  it("counts a repeated or differently written phrase once", () => {
    expect(
      receivedAddition(["focus"], ["timer", "Timer", "timer "], 0),
    ).toEqual({ added: ["timer"], held: [], leftOut: 0 });
  });
});

describe("additionOutcome", () => {
  const result = localizations([listed("en-US", ["focus", "timer"])]);

  it("answers nothing without a localization or anything received", () => {
    expect(additionOutcome(result, null, ["deep work"], null)).toBeNull();
    expect(additionOutcome(result, "en-US", null, null)).toBeNull();
    expect(additionOutcome(result, "en-US", [], null)).toBeNull();
    expect(additionOutcome(result, "en-US", ["🎯"], null)).toBeNull();
  });

  it("splits the phrases against the field the page reads", () => {
    expect(
      additionOutcome(result, "en-US", ["timer", "deep work"], null),
    ).toEqual({
      state: "received",
      localization: "en-US",
      addition: { added: ["deep work"], held: ["timer"], leftOut: 0 },
    });
  });

  it("answers a received outcome when the field holds every phrase", () => {
    expect(additionOutcome(result, "en-US", ["focus", "timer"], null)).toEqual({
      state: "received",
      localization: "en-US",
      addition: { added: [], held: ["focus", "timer"], leftOut: 0 },
    });
  });

  it("answers a received outcome when only the left out count arrives", () => {
    expect(additionOutcome(result, "en-US", null, 2)).toEqual({
      state: "received",
      localization: "en-US",
      addition: { added: [], held: [], leftOut: 2 },
    });
  });

  it("refuses a field App Store Connect manages", () => {
    expect(
      additionOutcome(
        localizations([listed("en-US", ["focus"])], true),
        "en-US",
        ["deep work"],
        null,
      ),
    ).toEqual({ state: "managed", localization: "en-US" });
  });

  it("refuses a localization the app does not list, managed or not", () => {
    const unlisted = { state: "unlisted", localization: "fr" };
    expect(additionOutcome(result, "fr", ["deep work"], null)).toEqual(
      unlisted,
    );
    expect(
      additionOutcome(
        localizations([listed("en-US")], true),
        "fr",
        ["deep work"],
        null,
      ),
    ).toEqual(unlisted);
  });
});

const read = (
  localization: AppStoreLocalization,
  shipped: boolean,
  phrases: string[] = [],
): MarketLocalizationRead => ({
  localization,
  role: "default",
  shipped,
  origin: shipped ? "manual" : null,
  phrases,
  charactersUsed: keywordFieldChars(phrases),
  charactersLimit: 100,
});

describe("keywordFieldTarget", () => {
  it("picks the first localization the market reads that the app ships", () => {
    const reads = [read("es-MX", false), read("en-GB", true, ["focus"])];
    expect(keywordFieldTarget(reads)).toEqual({
      localization: "en-GB",
      stored: ["focus"],
    });
  });

  it("falls back to the market's first read when the app ships none", () => {
    expect(
      keywordFieldTarget([read("de", false), read("en-GB", false)]),
    ).toEqual({ localization: "de", stored: [] });
  });

  it("answers nothing for a market that reads no localization", () => {
    expect(keywordFieldTarget([])).toBeNull();
  });
});

describe("keywordFieldAddition", () => {
  it("adds the new phrases after the stored ones in the order given", () => {
    expect(keywordFieldAddition(["focus"], ["timer app", "deep work"])).toEqual(
      { added: ["timer app", "deep work"], held: [], leftOut: 0 },
    );
  });

  it("counts a phrase the field holds as already in, not as added", () => {
    expect(
      keywordFieldAddition(["focus", "timer"], ["timer", "deep work"]),
    ).toEqual({ added: ["deep work"], held: ["timer"], leftOut: 0 });
  });

  it("normalizes and deduplicates the selection", () => {
    expect(
      keywordFieldAddition([], ["Deep Work", "deep work ", "focus"]).added,
    ).toEqual(["deep work", "focus"]);
  });

  it("leaves out what does not fit in 100 code points and keeps trying shorter ones", () => {
    expect(
      keywordFieldAddition(
        ["a".repeat(80)],
        ["b".repeat(30), "cc", "d".repeat(20)],
      ),
    ).toEqual({ added: ["cc"], held: [], leftOut: 2 });
  });

  it("counts code points, not UTF-16 units", () => {
    const stored = ["a".repeat(95)];
    expect(keywordFieldAddition(stored, ["𠀀𠀀𠀀"]).added).toEqual(["𠀀𠀀𠀀"]);
    expect(keywordFieldAddition(stored, ["时间管理器"]).added).toEqual([]);
  });

  it("drops a phrase that normalizes to nothing", () => {
    expect(keywordFieldAddition([], ["🎯"])).toEqual({
      added: [],
      held: [],
      leftOut: 0,
    });
  });

  it("adds nothing to a stored field that is already over the limit", () => {
    expect(
      keywordFieldAddition(["a".repeat(60), "b".repeat(60)], ["cc"]),
    ).toEqual({ added: [], held: [], leftOut: 1 });
  });

  it("answers an empty addition for an empty selection", () => {
    expect(keywordFieldAddition(["focus"], [])).toEqual({
      added: [],
      held: [],
      leftOut: 0,
    });
  });
});

describe("additionNotice", () => {
  const name = "English (U.S.)";
  const phrases = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, index) => `${prefix} ${index}`);
  const addition = (added: number, alreadyIn: number, leftOut: number) => ({
    added: phrases(added, "new"),
    held: phrases(alreadyIn, "held"),
    leftOut,
  });

  it("says how many keywords did not fit", () => {
    expect(additionNotice(addition(1, 0, 1), name)).toBe(
      "1 keyword did not fit in the English (U.S.) keyword field and was left out.",
    );
    expect(additionNotice(addition(1, 1, 2), name)).toBe(
      "2 keywords did not fit in the English (U.S.) keyword field and were left out.",
    );
  });

  it("says when every selected keyword is already in the field", () => {
    expect(additionNotice(addition(0, 2, 0), name)).toBe(
      "Every selected keyword is already in the English (U.S.) keyword field.",
    );
  });

  it("counts the keywords already in the field beside new ones", () => {
    expect(additionNotice(addition(2, 1, 0), name)).toBe(
      "1 keyword is already in the English (U.S.) keyword field.",
    );
    expect(additionNotice(addition(1, 3, 0), name)).toBe(
      "3 keywords are already in the English (U.S.) keyword field.",
    );
  });

  it("says nothing when every keyword was added", () => {
    expect(additionNotice(addition(2, 0, 0), name)).toBeNull();
  });
});
