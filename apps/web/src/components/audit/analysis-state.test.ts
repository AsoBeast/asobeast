import { describe, expect, it } from "vitest";
import type {
  AppAuditResult,
  AuditAiRunState,
  AuditCreative,
} from "@asobeast/shared";
import { APP_AUDIT_EXAMPLE } from "./audit-example";
import {
  ANALYSIS_ACTION,
  ANALYSIS_COPY,
  analysisState,
  type AnalysisState,
} from "./analysis-state";

const withRun = (
  state: AuditAiRunState | null,
  extra: Partial<AppAuditResult> = {},
): AppAuditResult => ({
  ...APP_AUDIT_EXAMPLE,
  ...extra,
  ai: {
    ...APP_AUDIT_EXAMPLE.ai,
    configured: true,
    run: state
      ? { state, requestedAt: null, finishedAt: null, error: null }
      : null,
  },
});

const staleCreative = (creative: AuditCreative): AuditCreative => ({
  ...creative,
  stale: true,
});

describe("analysisState", () => {
  it("reports an unconfigured key before anything else", () => {
    expect(
      analysisState(
        {
          ...APP_AUDIT_EXAMPLE,
          ai: { ...APP_AUDIT_EXAMPLE.ai, configured: false },
        },
        true,
      ),
    ).toBe("unconfigured");
  });

  it.each([
    [null, "never"],
    ["queued", "active"],
    ["running", "active"],
    ["completed", "current"],
    ["failed", "failed"],
  ] as const)("reads a %s run as %s", (state, expected) => {
    expect(analysisState(withRun(state), false)).toBe(expected);
  });

  it("prefers a stale creative over a completed run", () => {
    const audit = withRun("completed");
    expect(
      analysisState(
        { ...audit, creative: staleCreative(audit.creative!) },
        false,
      ),
    ).toBe("stale");
  });

  it("lets a pending mutation win over every configured state", () => {
    expect(analysisState(withRun("completed"), true)).toBe("requesting");
  });

  it("names copy and an action for every state", () => {
    const states = [
      "unconfigured",
      "never",
      "requesting",
      "active",
      "current",
      "stale",
      "failed",
    ] as const satisfies readonly AnalysisState[];

    expect(Object.keys(ANALYSIS_COPY).sort()).toEqual([...states].sort());
    expect(Object.keys(ANALYSIS_ACTION).sort()).toEqual([...states].sort());
  });
});
