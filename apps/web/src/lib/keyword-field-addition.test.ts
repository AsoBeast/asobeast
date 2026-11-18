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
  proposedKeywordField,
} from "./keyword-field-addition";

const listed = (
  localization: AppStoreLocalization,
  phrases: string[] = [],
): AppLocalizationItem => ({
  localization,
  origin: "home",
  phrases,
  charactersUsed: phrases.join(",").length,
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
});

describe("keywordFieldAdditionHref", () => {
  it("opens the localization's editor with the phrases", () => {
    expect(
      keywordFieldAdditionHref("app-1", "en-US", ["focus timer", "deep work"]),
    ).toBe(
      "/apps/app-1/metadata?fieldLocale=en-US&fieldAdd=focus+timer,deep+work#app-localizations",
    );
  });

  it("is the plain edit address when nothing is added", () => {
    expect(keywordFieldAdditionHref("app-1", "en-US", [])).toBe(
      editLocalizationHref("app-1", "en-US"),
    );
  });
});

describe("additionOutcome", () => {
  const result = localizations([listed("en-US", ["focus", "timer"])]);

  it("answers nothing without a localization or phrases", () => {
    expect(additionOutcome(result, null, ["deep work"])).toBeNull();
    expect(additionOutcome(result, "en-US", null)).toBeNull();
    expect(additionOutcome(result, "en-US", [])).toBeNull();
  });

  it("counts only the phrases the field does not hold yet", () => {
    expect(additionOutcome(result, "en-US", ["timer", "deep work"])).toEqual({
      state: "added",
      localization: "en-US",
      count: 1,
    });
  });

  it("answers nothing when the field holds every phrase", () => {
    expect(additionOutcome(result, "en-US", ["focus", "timer"])).toBeNull();
  });

  it("refuses a field App Store Connect manages", () => {
    expect(
      additionOutcome(
        localizations([listed("en-US", ["focus"])], true),
        "en-US",
        ["deep work"],
      ),
    ).toEqual({ state: "managed", localization: "en-US", count: 1 });
  });

  it("refuses a localization the app does not list, managed or not", () => {
    const unlisted = { state: "unlisted", localization: "fr", count: 1 };
    expect(additionOutcome(result, "fr", ["deep work"])).toEqual(unlisted);
    expect(
      additionOutcome(localizations([listed("en-US")], true), "fr", [
        "deep work",
      ]),
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
      { added: ["timer app", "deep work"], alreadyIn: 0, leftOut: 0 },
    );
  });

  it("counts a phrase the field holds as already in, not as added", () => {
    expect(
      keywordFieldAddition(["focus", "timer"], ["timer", "deep work"]),
    ).toEqual({ added: ["deep work"], alreadyIn: 1, leftOut: 0 });
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
    ).toEqual({ added: ["cc"], alreadyIn: 0, leftOut: 2 });
  });

  it("counts code points, not UTF-16 units", () => {
    const stored = ["a".repeat(95)];
    expect(keywordFieldAddition(stored, ["𠀀𠀀𠀀"]).added).toEqual(["𠀀𠀀𠀀"]);
    expect(keywordFieldAddition(stored, ["时间管理器"]).added).toEqual([]);
  });

  it("drops a phrase that normalizes to nothing", () => {
    expect(keywordFieldAddition([], ["🎯"])).toEqual({
      added: [],
      alreadyIn: 0,
      leftOut: 0,
    });
  });

  it("adds nothing to a stored field that is already over the limit", () => {
    expect(
      keywordFieldAddition(["a".repeat(60), "b".repeat(60)], ["cc"]),
    ).toEqual({ added: [], alreadyIn: 0, leftOut: 1 });
  });

  it("answers an empty addition for an empty selection", () => {
    expect(keywordFieldAddition(["focus"], [])).toEqual({
      added: [],
      alreadyIn: 0,
      leftOut: 0,
    });
  });
});

describe("additionNotice", () => {
  const name = "English (U.S.)";
  const addition = (added: number, alreadyIn: number, leftOut: number) => ({
    added: Array.from({ length: added }, (_, index) => `phrase ${index}`),
    alreadyIn,
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
