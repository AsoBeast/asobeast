import type { ActionEvidence, ActionRule } from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { ACTIONS } from "../../../e2e/fixtures.mts";
import { evidenceSections } from "./evidence-sections";

function evidenceOf(id: string): ActionEvidence {
  const evidence = ACTIONS.find((item) => item.id === id)?.evidence;
  if (!evidence) throw new Error(`no evidence for ${id}`);
  return evidence;
}

const factValues = (evidence: ActionEvidence) =>
  Object.fromEntries(
    evidenceSections(evidence).facts.map((fact) => [fact.label, fact.value]),
  );

const lists = (evidence: ActionEvidence) =>
  Object.fromEntries(
    evidenceSections(evidence).lists.map((list) => [
      list.label,
      list.items.map((item) =>
        item.detail ? `${item.text} ${item.detail}` : item.text,
      ),
    ]),
  );

describe("evidenceSections", () => {
  it("grades the opportunity of an uncovered keyword and lists its fields", () => {
    const evidence = evidenceOf("act-uncovered");
    const { facts } = evidenceSections(evidence);

    expect(factValues(evidence)).toMatchObject({
      Opportunity: "66.5",
      Volume: "62",
      "Keyword field free": "18",
    });
    expect(facts.find((fact) => fact.label === "Opportunity")?.grade).toEqual({
      metric: "opportunity",
      value: 66.5,
    });
    expect(lists(evidence)["Uncovered in"]).toEqual([
      "Title",
      "Subtitle",
      "Keyword field",
    ]);
  });

  it("lists the entrants of a defended keyword with their positions", () => {
    const evidence = evidenceOf("act-defend");

    expect(factValues(evidence)["Your position"]).toBe("6");
    expect(lists(evidence)["New in the top 10"]).toEqual([
      "Rival Habits #3",
      "Streaks Pro #5 · competitor",
    ]);
  });

  it("states how a pruned keyword ranked and what pruning saves", () => {
    const evidence = evidenceOf("act-prune");

    expect(factValues(evidence)).toMatchObject({
      "Ranked days": "0",
      "Checked days": "40",
    });
    expect(evidenceSections(evidence).lists).toEqual([]);
  });

  it("lists the changed fields and the keywords that fell after a drop", () => {
    const evidence = evidenceOf("act-drop");
    const sections = evidenceSections(evidence);

    expect(lists(evidence)["Changed fields"]).toEqual(["Title"]);
    expect(
      sections.lists
        .find((list) => list.label === "Keywords that fell")
        ?.items.every((item) => item.tone === "down"),
    ).toBe(true);
  });

  it("lists the rules a volatile result holds back", () => {
    const evidence = evidenceOf("act-volatile");
    if (evidence.rule !== "serp.hold_volatile") throw new Error("fixture");
    const held = evidenceSections({
      ...evidence,
      dampenedRules: ["keyword.defend"] as ActionRule[],
    });

    expect(held.lists).toEqual([
      { label: "Rules held back", items: [{ text: "Keywords to defend" }] },
    ]);
  });

  it("grades the overall audit and lists the checks to fix", () => {
    const evidence = evidenceOf("act-audit");
    const { facts } = evidenceSections(evidence);

    expect(factValues(evidence)).toMatchObject({ Score: "3 of 10" });
    expect(facts.find((fact) => fact.label === "Overall audit")?.grade).toEqual(
      { metric: "audit", value: 61 },
    );
    expect(lists(evidence)["Checks to fix"]).toEqual(["Screenshot count fail"]);
  });

  it("counts the mentions of a review theme", () => {
    expect(factValues(evidenceOf("act-reviews"))).toMatchObject({
      Theme: "crashes on launch",
      Mentions: "9",
      "Sample reviews": "2",
    });
  });

  it("compares the market with the home market", () => {
    expect(factValues(evidenceOf("act-market"))).toMatchObject({
      Market: "DE",
      "Home market": "US",
      Gap: "26.5",
    });
  });

  it("grades the position of a keyword near the top 10 and names its fields", () => {
    const evidence = evidenceOf("act-push");
    const { facts } = evidenceSections(evidence);

    expect(factValues(evidence)).toMatchObject({
      "Latest position": "12",
      "Best position": "11",
      "Days in band": "6 of 7",
      Volume: "54",
      Relevance: "80",
      Opportunity: "41.5",
    });
    expect(
      facts.find((fact) => fact.label === "Latest position")?.grade,
    ).toEqual({ metric: "position", value: 12 });
    expect(lists(evidence)).toEqual({
      "Covered only by": ["Keyword field"],
      "Strong fields": ["Title", "Subtitle"],
    });
  });

  it("lists the keywords a competitor passed you on after its change", () => {
    const evidence = evidenceOf("act-overtake");

    expect(factValues(evidence)).toMatchObject({
      Competitor: "Tomato Focus",
      "New title": "Tomato Focus: Habit Tracker",
      "New subtitle": "—",
      "Keywords passed": "2",
    });
    expect(lists(evidence)).toEqual({
      "Changed fields": ["Title"],
      "Keywords they passed you on": [
        "habit tracker you 6 → 9, them 14 → 4 · in their new text",
        "streak counter you 8 → 11, them 12 → 7",
      ],
    });
  });

  it("grades the recent review average against the earlier one", () => {
    const evidence = evidenceOf("act-decline");
    const { facts } = evidenceSections(evidence);

    expect(factValues(evidence)).toMatchObject({
      "Recent average": "3.5",
      "Earlier average": "4.5",
      Drop: "1",
      "Recent reviews": "8 in 14 days",
      "Negative share": "25%",
      "Latest version": "4.2.0",
    });
    expect(
      facts.find((fact) => fact.label === "Recent average")?.grade,
    ).toEqual({ metric: "rating", value: 3.5 });
  });

  it("lists the keywords that fell with no change of yours", () => {
    const evidence = evidenceOf("act-slide");

    expect(factValues(evidence)).toMatchObject({
      Market: "US",
      "Visibility before": "40",
      "Visibility after": "32.5",
      "Visibility delta": "7.5",
      "Your last change": "—",
    });
    expect(lists(evidence)["Keywords that fell"]).toEqual([
      "streak counter 8 → 17",
    ]);
  });

  it("counts the characters of a field that breaks a store rule and lists its problems", () => {
    const evidence = evidenceOf("act-lint");
    if (evidence.rule !== "metadata.fix_lint") throw new Error("fixture");
    const withEmoji: ActionEvidence = {
      ...evidence,
      issues: [
        ...evidence.issues,
        {
          rule: "emoji",
          message: "Emoji are not allowed in the title.",
          offendingText: "🔥",
        },
      ],
    };

    expect(factValues(evidence)).toEqual({
      Field: "Title",
      Characters: "34 of 30",
      Problems: "1",
    });
    expect(lists(withEmoji)["Problems to fix"]).toEqual([
      "Exceeds the 30 character limit (34).",
      "Emoji are not allowed in the title. 🔥",
    ]);
    expect(evidenceSections(evidence).summary).toBe(
      "Title has 1 store rule problem at 34 of 30 characters.",
    );
  });

  it("omits an empty list and keeps the summary sentence", () => {
    const evidence = evidenceOf("act-snoozed");
    const sections = evidenceSections(evidence);

    expect(sections.lists).toEqual([]);
    expect(sections.summary).toMatch(/new apps entered the top 10/);
  });
});
