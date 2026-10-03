import { describe, expect, it } from "vitest";
import type { AdminUser, SupportWorkspaceSummary } from "@asobeast/shared";
import { userMatches, workspaceMatches } from "./admin-search";

const USER: AdminUser = {
  id: "u2",
  email: "ana@example.com",
  name: "Ana Nowak",
  role: "owner",
  emailVerified: true,
  platformOperator: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  workspaceId: "ws_ana",
  workspaceName: "Ana Apps",
  workspacePlan: "indie",
};

const WORKSPACE: SupportWorkspaceSummary = {
  workspaceId: "ws_ana",
  name: "Ana Apps",
  plan: "indie",
  storedPlan: "indie",
  createdAt: "2026-10-01T10:00:00.000Z",
  suspendedAt: null,
  suspendedReason: null,
  trialEndsAt: null,
  planExpiresAt: null,
  subscriptionStatus: "active",
  hasSubscription: true,
  members: 2,
  apps: 2,
  competitors: 3,
  keywordMarkets: 40,
};

describe("userMatches", () => {
  it("finds a user by email, name, workspace name or workspace id", () => {
    expect(userMatches(USER, "ana@")).toBe(true);
    expect(userMatches(USER, "nowak")).toBe(true);
    expect(userMatches(USER, "ana apps")).toBe(true);
    expect(userMatches(USER, "ws_ana")).toBe(true);
    expect(userMatches(USER, "zzz")).toBe(false);
  });

  it("ignores case and accents", () => {
    expect(userMatches({ ...USER, name: "Anà" }, "ANA")).toBe(true);
  });

  it("finds a user without a name", () => {
    expect(userMatches({ ...USER, name: null }, "ana@example")).toBe(true);
  });
});

describe("workspaceMatches", () => {
  it("finds a workspace by name or id, ignoring case", () => {
    expect(workspaceMatches(WORKSPACE, "ANA APPS")).toBe(true);
    expect(workspaceMatches(WORKSPACE, "ws_ana")).toBe(true);
    expect(workspaceMatches(WORKSPACE, "lapsed")).toBe(false);
  });
});
