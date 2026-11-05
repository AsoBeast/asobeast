import {
  buildChecklist,
  type ChecklistFacts,
  type WorkspaceChecklist,
} from "@asobeast/shared";
import { describe, expect, it } from "vitest";
import { applyChecklistPatch } from "./checklist-patch";

const FACTS: ChecklistFacts = {
  apps: [],
  consoleAvailable: true,
  consoleConnections: 0,
  usedTokens: 0,
  alertChannels: 0,
  reviewsStored: true,
  replies: 0,
};

const NOW = new Date("2026-11-05T12:00:00.000Z");
const EARLIER = "2026-11-01T00:00:00.000Z";

const checklist = (
  goal: WorkspaceChecklist["goal"] = null,
  dismissedAt: string | null = null,
) => buildChecklist(FACTS, goal, dismissedAt);

const ids = (value: WorkspaceChecklist) => value.items.map((item) => item.id);

describe("applyChecklistPatch", () => {
  it("stamps a first dismissal with now", () => {
    expect(
      applyChecklistPatch(checklist(), { dismissed: true }, NOW).dismissedAt,
    ).toBe(NOW.toISOString());
  });

  it("keeps the first dismissal when dismissed again", () => {
    expect(
      applyChecklistPatch(checklist(null, EARLIER), { dismissed: true }, NOW)
        .dismissedAt,
    ).toBe(EARLIER);
  });

  it("clears the dismissal when shown again", () => {
    expect(
      applyChecklistPatch(checklist(null, EARLIER), { dismissed: false }, NOW)
        .dismissedAt,
    ).toBeNull();
  });

  it("sets a goal and reorders the items for it", () => {
    const next = applyChecklistPatch(checklist(), { goal: "use_with_ai" }, NOW);
    expect(next.goal).toBe("use_with_ai");
    expect(ids(next)).toEqual(ids(checklist("use_with_ai")));
  });

  it("clears the goal and restores the default order", () => {
    const next = applyChecklistPatch(
      checklist("improve_rankings"),
      { goal: null },
      NOW,
    );
    expect(next.goal).toBeNull();
    expect(ids(next)).toEqual(ids(checklist()));
  });

  it("leaves its input untouched", () => {
    const before = checklist();
    const copy = structuredClone(before);
    applyChecklistPatch(
      before,
      { goal: "research_idea", dismissed: true },
      NOW,
    );
    expect(before).toEqual(copy);
  });

  it("answers an equal checklist for an empty patch", () => {
    expect(applyChecklistPatch(checklist(), {}, NOW)).toEqual(checklist());
  });
});
