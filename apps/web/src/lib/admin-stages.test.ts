import { describe, expect, it } from "vitest";
import { WORKSPACE_STAGES } from "@asobeast/shared";
import {
  WORKSPACE_STAGE_LABELS,
  heldPlanLabel,
  stageLabel,
} from "./admin-stages";

describe("stageLabel", () => {
  it("names every stage in plain words", () => {
    for (const stage of WORKSPACE_STAGES) {
      expect(WORKSPACE_STAGE_LABELS[stage]).toMatch(/^[A-Z][a-z ]+$/);
    }
  });

  it("names a card trial as a trial whatever plan it holds", () => {
    expect(stageLabel("trialing", "indie")).toBe("On trial");
  });

  it("falls back to the plan when the api answers no stage", () => {
    expect(stageLabel(undefined, "ultimate")).toBe("Ultimate");
  });
});

describe("heldPlanLabel", () => {
  it("names a paid plan and nothing else", () => {
    expect(heldPlanLabel("indie")).toBe("Indie");
    expect(heldPlanLabel("trial")).toBeNull();
    expect(heldPlanLabel("free")).toBeNull();
  });
});
