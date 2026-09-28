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

  it("omits an empty list and keeps the summary sentence", () => {
    const evidence = evidenceOf("act-snoozed");
    const sections = evidenceSections(evidence);

    expect(sections.lists).toEqual([]);
    expect(sections.summary).toMatch(/new apps entered the top 10/);
  });
});
