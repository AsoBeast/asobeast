import { describe, expect, it } from "vitest";
import { ACTION_RULES, type ActionEvidence } from "@asobeast/shared";
import { ACTIONS } from "../../../e2e/fixtures.mts";
import { actionBrief, briefText } from "./action-brief";

const evidenceOf = (id: string): ActionEvidence => {
  const evidence = ACTIONS.find((action) => action.id === id)?.evidence;
  if (!evidence) throw new Error(`no evidence for ${id}`);
  return evidence;
};

const brief = (id: string): string => briefText(actionBrief(evidenceOf(id)));

describe("actionBrief", () => {
  it("says why an uncovered keyword is worth adding and where it fits", () => {
    expect(brief("act-uncovered")).toBe(
      "Opportunity 66.5 · volume 62 · in no indexed field · 18 characters free in the keyword field",
    );
  });

  it("names the positions and the apps that entered above a defended keyword", () => {
    expect(brief("act-defend")).toBe(
      "You moved from #4 to #6 · Rival Habits entered at #3, Streaks Pro entered at #5",
    );
    expect(brief("act-snoozed")).toBe(
      "You moved from #7 to #9 · no new app at or above you",
    );
  });

  it("ties a visibility drop to the listing change before it", () => {
    expect(brief("act-drop")).toBe(
      "Visibility fell from 42.1 to 31.4 · your title changed on Jul 24, 2026 · 1 keyword fell",
    );
    expect(brief("act-slide")).toBe(
      "Visibility fell from 40 to 32.5 · 14 days with no change of yours · 1 keyword fell",
    );
  });

  it("quotes a competitor's new text and the keywords it took", () => {
    expect(brief("act-overtake")).toBe(
      'New title "Tomato Focus: Habit Tracker" · ahead of you on habit tracker and streak counter',
    );
  });

  it("counts the characters of a field that breaks a store rule", () => {
    expect(brief("act-lint")).toBe("Title is 34 of 30 characters");
  });

  it("reads the funnel figures of a conversion drop", () => {
    expect(brief("act-conversion")).toBe(
      "Get taps fell from 61 to 44 a day · page views 410 to 402 · conversion 3.1% to 2.2%",
    );
  });

  it("marks the figure a reader should see first", () => {
    const [first] = actionBrief(evidenceOf("act-prune"));

    expect(first).toEqual(["Never ranked in ", { strong: "40" }, " checks"]);
  });

  it("has a reason for every rule the mock queue holds", () => {
    const rules = new Set<string>();
    for (const action of ACTIONS) {
      if (!action.evidence) continue;
      rules.add(action.rule);
      expect(briefText(actionBrief(action.evidence))).not.toBe("");
    }

    expect(ACTION_RULES.filter((rule) => !rules.has(rule))).toEqual([]);
  });
});
