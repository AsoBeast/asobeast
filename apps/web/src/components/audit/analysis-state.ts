import type { AppAuditResult } from "@asobeast/shared";

export type AnalysisState =
  | "unconfigured"
  | "never"
  | "requesting"
  | "active"
  | "current"
  | "stale"
  | "failed";

export function analysisState(
  audit: AppAuditResult,
  requesting: boolean,
): AnalysisState {
  if (!audit.ai.configured) return "unconfigured";
  if (requesting) return "requesting";
  const state = audit.ai.run?.state;
  if (state === "queued" || state === "running") return "active";
  if (state === "failed") return "failed";
  if (audit.creative?.stale) return "stale";
  if (state === "completed" && audit.creative) return "current";
  return "never";
}

export const ANALYSIS_COPY: Record<AnalysisState, string> = {
  unconfigured:
    "Add OPENAI_API_KEY to let AI read your icon and screenshots. Everything else in this audit works without it.",
  never:
    "AI reads your icon and first six screenshots, and your competitors' icons, and reports what it sees. The rules score it.",
  requesting: "Queuing the analysis.",
  active: "You can leave this page. The audit updates when it finishes.",
  current: "The analysis matches your current icon and screenshots.",
  stale: "Your icon or screenshots changed since the last analysis.",
  failed: "Nothing was charged to the score.",
};

export const ANALYSIS_ACTION: Record<AnalysisState, string | null> = {
  unconfigured: null,
  never: "Analyze creative",
  requesting: "Queuing",
  active: null,
  current: null,
  stale: "Analyze again",
  failed: "Try again",
};

export const progressLine = (screenshots: number | null): string =>
  screenshots === null
    ? "Analyzing your icon and screenshots"
    : `Analyzing your icon and ${screenshots} screenshot${screenshots === 1 ? "" : "s"}`;

export const AI_FEATURES_GUIDE = "https://docs.asobeast.com/guides/ai-features";
