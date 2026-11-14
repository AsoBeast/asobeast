import type { MetadataAuditResult } from "@asobeast/shared";

export const METADATA_AUDIT_COOKIE = "e2e_metadata_audit";

export const TITLE_OVER_LIMIT = "Focus Timer: Pomodoro and Deep Work Sessions";

const LINTED_FIELDS: MetadataAuditResult["fields"] = [
  {
    field: "title",
    value: TITLE_OVER_LIMIT,
    chars: TITLE_OVER_LIMIT.length,
    limit: 30,
    indexed: true,
    issues: [
      {
        rule: "over-limit",
        severity: "error",
        message: "The title is 14 characters over the limit.",
      },
    ],
  },
  {
    field: "subtitle",
    value: "Timer for focus timer sessions",
    chars: 30,
    limit: 30,
    indexed: true,
    issues: [
      {
        rule: "repeats-title-word",
        severity: "warn",
        message: "“timer” already appears in the title.",
      },
      {
        rule: "no-benefit",
        severity: "info",
        message: "The subtitle names no benefit.",
      },
    ],
  },
];

export function metadataAuditVariant(
  variant: string | undefined,
  audit: MetadataAuditResult,
): MetadataAuditResult {
  if (variant === "empty") {
    return { ...audit, coverage: [], keywordFieldSuggestion: null };
  }
  if (variant === "issues") {
    return {
      ...audit,
      fields: [
        ...LINTED_FIELDS,
        ...audit.fields.filter(
          (field) => field.field !== "title" && field.field !== "subtitle",
        ),
      ],
    };
  }
  if (variant === "suggestion") {
    return {
      ...audit,
      keywordFieldSuggestion: {
        value: "focus,timer,habits",
        charactersUsed: 18,
        charactersLimit: 100,
        addedTerms: ["habits"],
      },
    };
  }
  return audit;
}
