import { ACTION_RULES, type ActionItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../../e2e/fixtures.mts";
import { actionSteps, CONFIRMATION_STEP } from "./action-steps";
import { actionItem } from "./action-test-item";

const LONG_KEYWORD =
  "pomodoro timer for deep focus sessions and study breaks with ambient sounds";

const WITH_EVIDENCE = ACTIONS.filter((item) => item.evidence !== null);

const onStore = (item: ActionItem, store: ActionItem["scope"]["store"]) => ({
  ...item,
  scope: { ...item.scope, store },
});

describe("actionSteps", () => {
  it("covers every rule with a fixture", () => {
    expect(new Set(WITH_EVIDENCE.map((item) => item.rule))).toEqual(
      new Set(ACTION_RULES),
    );
  });

  it.each(WITH_EVIDENCE.map((item) => [item.id, item] as const))(
    "gives %s at least two steps before the confirmation with the confirmation",
    (_id, item) => {
      const steps = actionSteps(item);

      expect(steps.length).toBeGreaterThanOrEqual(3);
      expect(steps.at(-1)).toMatch(/^AsoBeast /);
    },
  );

  it("never mentions the subtitle or the keyword field on Google Play", () => {
    for (const item of WITH_EVIDENCE) {
      const text = actionSteps(onStore(item, "GOOGLE_PLAY")).join(" ");

      expect(text).not.toMatch(/subtitle|keyword field/i);
    }
  });

  it("offers the keyword field room only when there is some", () => {
    const uncovered = ACTIONS.find((item) => item.id === "act-uncovered")!;
    const evidence = uncovered.evidence!;
    if (evidence.rule !== "keyword.add_uncovered") throw new Error("fixture");

    expect(actionSteps(uncovered)[1]).toBe(
      'Put "habit tracker" in the subtitle, or in the keyword field (18 characters free)',
    );
    expect(
      actionSteps({
        ...uncovered,
        evidence: { ...evidence, keywordFieldCharsFree: 0 },
      })[1],
    ).toBe('Put "habit tracker" in the subtitle, or in the keyword field');
  });

  it("moves a keyword near the top 10 into a strong field on each store", () => {
    const push = ACTIONS.find((item) => item.id === "act-push")!;
    const confirmation =
      "AsoBeast confirms the fix when the keyword reaches the top 10 or stops qualifying";

    expect(actionSteps(push)).toEqual([
      `Move "${LONG_KEYWORD}" into the subtitle or the title`,
      "Keep the words together and in this order",
      "Ship it with your next release",
      confirmation,
    ]);
    expect(actionSteps(onStore(push, "GOOGLE_PLAY"))).toEqual([
      `Add "${LONG_KEYWORD}" to the title or the short description`,
      "Keep the words together and in this order",
      "Publish the listing change in Play Console",
      confirmation,
    ]);
    expect(actionSteps(push)).not.toContain(CONFIRMATION_STEP);
  });

  it("turns each store rule problem into a step before shipping the fix", () => {
    const lint = ACTIONS.find((item) => item.id === "act-lint")!;
    const evidence = lint.evidence!;
    if (evidence.rule !== "metadata.fix_lint") throw new Error("fixture");
    const emoji = {
      rule: "emoji",
      message: "Emoji are not allowed in the title.",
      offendingText: "🔥",
    };

    expect(
      actionSteps({
        ...lint,
        evidence: { ...evidence, issues: [...evidence.issues, emoji] },
      }),
    ).toEqual([
      "Exceeds the 30 character limit (34).",
      "Emoji are not allowed in the title.",
      "Save and ship the listing change",
      CONFIRMATION_STEP,
    ]);
  });

  it("sends unanswered Play reviews to the reply composer", () => {
    const reply = ACTIONS.find((item) => item.id === "act-reply")!;

    expect(actionSteps(reply)).toEqual([
      "Open the reviews that need a reply, lowest first",
      "Draft or write each reply, copy it and paste it in Play Console",
      "Mark the review as replied; AsoBeast also sees the reply on the store the next day",
      CONFIRMATION_STEP,
    ]);
  });

  it("sends a review theme to the reviews page to reply", () => {
    const theme = ACTIONS.find((item) => item.id === "act-reviews")!;

    expect(actionSteps(theme)).toEqual([
      'Read the low reviews that mention "crashes on launch"',
      "Check what changed in version 4.2.0",
      "Reply from the reviews page where a fix is coming",
      CONFIRMATION_STEP,
    ]);
  });

  it("sends a rating decline to the reviews page to reply", () => {
    const decline = ACTIONS.find((item) => item.id === "act-decline")!;

    expect(actionSteps(decline)).toEqual([
      "Read the recent low reviews",
      "Check what changed in version 4.2.0",
      "Reply from the reviews page where a fix is on its way",
      CONFIRMATION_STEP,
    ]);
  });

  it("confirms a stale listing fix once the store shows the update", () => {
    const stale = ACTIONS.find((item) => item.id === "act-stale")!;

    expect(actionSteps(stale)).toEqual([
      "Plan a release, even a small one",
      "Write release notes that say what changed",
      "AsoBeast confirms the fix when the store shows the new update",
    ]);
  });

  it("turns each failing audit check into a step, in order", () => {
    const audit = ACTIONS.find((item) => item.id === "act-audit")!;
    const evidence = audit.evidence!;
    if (evidence.rule !== "audit.fix_factor") throw new Error("fixture");
    const check = { id: "c", status: "warn" as const, score: 5 };

    expect(
      actionSteps({
        ...audit,
        evidence: {
          ...evidence,
          failingChecks: [
            { ...check, label: "Screenshot count" },
            { ...check, label: "Captions" },
          ],
        },
      }),
    ).toEqual([
      "Open the audit for Screenshots",
      "Fix: Screenshot count",
      "Fix: Captions",
      CONFIRMATION_STEP,
    ]);
  });

  it("falls back to the rule title for degraded evidence", () => {
    expect(actionSteps(actionItem())).toEqual([
      "Add a high-opportunity keyword to your metadata",
      CONFIRMATION_STEP,
    ]);
  });
});
