import { describe, expect, it } from "vitest";
import type {
  AppLocalizationItem,
  AppStoreLocalization,
} from "@asobeast/shared";
import { editLocalizationHref } from "./app-localizations";
import {
  additionOutcome,
  keywordFieldAdditionHref,
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
