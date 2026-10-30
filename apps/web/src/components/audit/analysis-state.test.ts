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
  imageLinksLine,
  progressLine,
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
    if (!audit.creative) {
      throw new Error("Expected the example audit to carry a creative");
    }
    expect(
      analysisState(
        { ...audit, creative: staleCreative(audit.creative) },
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

  it("offers no action while the analysis is current", () => {
    expect(ANALYSIS_ACTION.current).toBeNull();
    expect(ANALYSIS_ACTION.stale).toBe("Analyze again");
  });
});

describe("progressLine", () => {
  it("names the screenshot count only when it is known", () => {
    expect(progressLine(4)).toBe("Analyzing your icon and 4 screenshots");
    expect(progressLine(1)).toBe("Analyzing your icon and 1 screenshot");
    expect(progressLine(null)).toBe("Analyzing your icon and screenshots");
  });
});

describe("imageLinksLine", () => {
  it("names OpenAI when the API names it", () => {
    expect(imageLinksLine("openai", "gpt-5.6-luna")).toBe(
      "Sends image links to OpenAI with gpt-5.6-luna.",
    );
  });

  it("names OpenAI when an older API reports no provider", () => {
    expect(imageLinksLine(undefined, "gpt-5.6-luna")).toBe(
      "Sends image links to OpenAI with gpt-5.6-luna.",
    );
  });

  it("never names OpenAI or a host for a compatible provider", () => {
    const line = imageLinksLine("compatible", "llava");

    expect(line).toBe(
      "Sends image links to llava on the AI provider this instance is configured with.",
    );
    expect(line).not.toMatch(/openai/i);
  });
});
