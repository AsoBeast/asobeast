import { ACTION_RULES, type ActionItem } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../../e2e/fixtures.mts";
import { actionSteps, CONFIRMATION_STEP } from "./action-steps";
import { actionItem } from "./action-test-item";

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
      expect(steps.at(-1)).toMatch(/^asobeast /);
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
