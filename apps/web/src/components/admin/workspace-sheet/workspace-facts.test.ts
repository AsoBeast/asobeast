import { describe, expect, it } from "vitest";
import type { SupportWorkspaceSummary } from "@asobeast/shared";
import {
  standingOf as localizedStandingOf,
  workspaceFacts as localizedWorkspaceFacts,
} from "./workspace-facts";
import { translationContext } from "@/test/translation-context";

const en = translationContext("en", "admin");
const standingOf = (workspace: SupportWorkspaceSummary) =>
  localizedStandingOf(workspace, en);
const workspaceFacts = (workspace: SupportWorkspaceSummary) =>
  localizedWorkspaceFacts(workspace, en);

const BASE: SupportWorkspaceSummary = {
  workspaceId: "ws_ana",
  name: "Ana Apps",
  operatorWorkspace: false,
  plan: "indie",
  storedPlan: "indie",
  createdAt: "2026-10-30T09:00:00.000Z",
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: null,
  hasSubscription: false,
  members: 2,
  apps: 2,
  competitors: 3,
  keywordMarkets: 40,
  stage: "paying",
};

describe("standingOf", () => {
  it("names the stage and the plan held", () => {
    expect(standingOf(BASE)).toBe("Paying · Indie");
    expect(standingOf({ ...BASE, plan: "free", stage: "no-plan" })).toBe(
      "No plan",
    );
  });

  it("names the plan where the API answers no stage", () => {
    expect(standingOf({ ...BASE, stage: undefined })).toBe("Indie");
  });
});

describe("workspaceFacts", () => {
  it("lists only the facts that have a value", () => {
    expect(workspaceFacts(BASE)).toEqual([
      { label: "Stage", value: "Paying · Indie" },
      { label: "Created", value: "Oct 30, 2026" },
    ]);
  });

  it("says how a subscription renews and when it ends", () => {
    const facts = workspaceFacts({
      ...BASE,
      subscriptionStatus: "past_due",
      billingInterval: "month",
      planExpiresAt: "2026-12-04T00:00:00.000Z",
    });

    expect(facts).toContainEqual({
      label: "Subscription",
      value: "past_due, renews monthly",
    });
    expect(facts).toContainEqual({
      label: "Period ends",
      value: "Dec 4, 2026",
    });
    expect(
      workspaceFacts({
        ...BASE,
        cancelAtPeriodEnd: true,
        planExpiresAt: "2026-12-04T00:00:00.000Z",
      }),
    ).toContainEqual({ label: "Cancels on", value: "Dec 4, 2026" });
  });

  it("never says a subscription that cancels at period end renews", () => {
    const facts = workspaceFacts({
      ...BASE,
      subscriptionStatus: "active",
      billingInterval: "month",
      cancelAtPeriodEnd: true,
      planExpiresAt: "2026-12-04T00:00:00.000Z",
    });

    expect(facts).toContainEqual({
      label: "Subscription",
      value: "active, billed monthly",
    });
    expect(facts).toContainEqual({ label: "Cancels on", value: "Dec 4, 2026" });
  });

  it("names a stored plan that differs, a suspension and a pending deletion", () => {
    const facts = workspaceFacts({
      ...BASE,
      plan: "trial",
      storedPlan: "free",
      suspendedAt: "2026-11-17T08:05:00.000Z",
      deletionDueAt: "2026-11-25T00:00:00.000Z",
      deletionRequestedAt: "2026-11-18T00:00:00.000Z",
      deletionRequestedBy: "kai@kestrel.example.com",
    });

    expect(facts).toContainEqual({ label: "Plan stored", value: "free" });
    expect(facts).toContainEqual({
      label: "Suspended since",
      value: "Nov 17, 2026, 8:05 AM UTC",
    });
    expect(facts).toContainEqual({
      label: "Deletes on",
      value: "Nov 25, 2026",
    });
    expect(facts).toContainEqual({
      label: "Deletion asked by",
      value: "kai@kestrel.example.com on Nov 18, 2026",
    });
  });
});
