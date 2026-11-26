import { describe, expect, it } from "vitest";
import {
  WORKSPACE_STAGES,
  type SupportWorkspaceSummary,
} from "@asobeast/shared";
import {
  flagHref,
  heldPlanLabel as localizedHeldPlanLabel,
  matchesStanding,
  payingPlanLabel as localizedPayingPlanLabel,
  stageHref,
  stageLabel as localizedStageLabel,
  workspaceFlags,
  workspaceStageLabel as localizedWorkspaceStageLabel,
} from "./admin-stages";
import { translationContext } from "@/test/translation-context";

const en = translationContext("en", "admin");
const workspaceStageLabel = (
  stage: Parameters<typeof localizedWorkspaceStageLabel>[0],
) => localizedWorkspaceStageLabel(stage, en.translator);
const stageLabel = (
  stage: Parameters<typeof localizedStageLabel>[0],
  plan: Parameters<typeof localizedStageLabel>[1],
) => localizedStageLabel(stage, plan, en.translator);
const heldPlanLabel = (plan: Parameters<typeof localizedHeldPlanLabel>[0]) =>
  localizedHeldPlanLabel(plan, en.translator);
const payingPlanLabel = (
  plan: Parameters<typeof localizedPayingPlanLabel>[0],
  interval: Parameters<typeof localizedPayingPlanLabel>[1],
) => localizedPayingPlanLabel(plan, interval, en.translator);

describe("stageLabel", () => {
  it("names every stage in plain words", () => {
    for (const stage of WORKSPACE_STAGES) {
      expect(workspaceStageLabel(stage)).toMatch(
        /^[A-Z][a-z]+(?:[ -][a-z]+)*$/,
      );
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

describe("payingPlanLabel", () => {
  it("names the plan and how often it renews", () => {
    expect(payingPlanLabel("indie", "month")).toBe("Indie · monthly");
    expect(payingPlanLabel("ultimate", "year")).toBe("Ultimate · yearly");
  });

  it("says so when the interval was never recorded", () => {
    expect(payingPlanLabel("indie", null)).toBe(
      "Indie · interval not recorded",
    );
  });
});

const NOW = Date.parse("2026-11-15T12:00:00.000Z");
const inDays = (days: number) =>
  new Date(NOW + days * 24 * 60 * 60_000).toISOString();

const workspace = (
  overrides: Partial<SupportWorkspaceSummary>,
): SupportWorkspaceSummary => ({
  workspaceId: "ws_1",
  name: "One",
  plan: "free",
  storedPlan: "free",
  createdAt: inDays(-10),
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: null,
  hasSubscription: false,
  members: 1,
  apps: 0,
  competitors: 0,
  keywordMarkets: 0,
  stage: "no-plan",
  cancelAtPeriodEnd: false,
  deletionDueAt: null,
  ...overrides,
});

describe("workspaceFlags", () => {
  it("flags a trial ending within three days, not one ending later", () => {
    expect(
      workspaceFlags(
        workspace({ stage: "trialing", trialEndsAt: inDays(2) }),
        NOW,
      ),
    ).toEqual(["ending-soon"]);
    expect(
      workspaceFlags(
        workspace({ stage: "trialing", trialEndsAt: inDays(5) }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("flags canceling only while something still renews", () => {
    expect(
      workspaceFlags(
        workspace({ stage: "paying", cancelAtPeriodEnd: true }),
        NOW,
      ),
    ).toEqual(["canceling"]);
    expect(
      workspaceFlags(
        workspace({ stage: "churned", cancelAtPeriodEnd: true }),
        NOW,
      ),
    ).toEqual([]);
  });

  it("flags a pending deletion and a suspension together", () => {
    expect(
      workspaceFlags(
        workspace({ deletionDueAt: inDays(6), suspendedAt: inDays(-1) }),
        NOW,
      ),
    ).toEqual(["deleting", "suspended"]);
  });
});

describe("matchesStanding", () => {
  const paying = workspace({ stage: "paying", cancelAtPeriodEnd: true });

  it("keeps every workspace with no filter", () => {
    expect(matchesStanding(paying, { stage: [], flag: [] }, NOW)).toBe(true);
  });

  it("keeps a workspace in any chosen stage that carries every chosen flag", () => {
    expect(
      matchesStanding(
        paying,
        { stage: ["trialing", "paying"], flag: ["canceling"] },
        NOW,
      ),
    ).toBe(true);
    expect(
      matchesStanding(paying, { stage: ["paying"], flag: ["deleting"] }, NOW),
    ).toBe(false);
    expect(matchesStanding(paying, { stage: ["churned"], flag: [] }, NOW)).toBe(
      false,
    );
  });
});

describe("filtered workspace links", () => {
  it("lands on the workspaces table filtered by a stage or a flag", () => {
    expect(stageHref("payment-failed")).toBe(
      "/admin/workspaces?stage=payment-failed",
    );
    expect(flagHref("ending-soon")).toBe("/admin/workspaces?flag=ending-soon");
  });
});
