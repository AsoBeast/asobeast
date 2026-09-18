import type {
  AppAuditResult,
  AuditFactorResult,
  AuditRecommendation,
} from "@asobeast/shared";
import {
  availabilityLabel,
  BUCKET_LABEL,
  BUCKETS,
  EFFORT_LABEL,
  gradeLabel,
  GROUP_LABEL,
  IMPACT_LABEL,
  liftLabel,
  percent,
  scoreStatus,
  STATUS_LABEL,
} from "./audit-copy";
import { storeLabel } from "@/lib/format";
import { comparison, COMPARISON_LABEL } from "./benchmark-comparison";

const DASH = "—";

const rounded = (value: number | null | undefined): string =>
  value === null || value === undefined ? DASH : String(Math.round(value));

export const escapeMarkdown = (text: string): string =>
  text
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s*\r?\n\s*/g, " ");

const recommendationLines = (item: AuditRecommendation): string[] => [
  `### ${escapeMarkdown(item.label)} · ${liftLabel(item.lift)}`,
  "",
  `${item.impact ? IMPACT_LABEL[item.impact] : "Impact unknown"} · ${
    item.effort ? EFFORT_LABEL[item.effort] : "Effort unknown"
  }`,
  "",
  escapeMarkdown(item.detail),
  ...(item.fix ? ["", escapeMarkdown(item.fix)] : []),
  "",
];

const headline = (audit: AppAuditResult): string =>
  `**${[
    `${rounded(audit.overall)}/100`,
    `Grade ${audit.grade ?? DASH}, ${gradeLabel(audit.grade)}`,
    ...(audit.confidence === undefined
      ? []
      : [`${percent(audit.confidence)}% measured`]),
    `Potential ${rounded(audit.potential)}`,
  ].join(" · ")}**`;

const groupLines = (audit: AppAuditResult): string[] => {
  const groups = audit.groups ?? [];
  if (groups.length === 0) return [];
  return [
    ...groups.map(
      (group) =>
        `- ${GROUP_LABEL[group.id]}: ${rounded(
          group.score === null ? null : group.score * 10,
        )}/100`,
    ),
    "",
  ];
};

const factorNotes = (
  factor: AuditFactorResult,
  audit: AppAuditResult,
): string => {
  const firstIssue = factor.checks.find(
    (check) => check.status === "warn" || check.status === "fail",
  );
  const scored = factor.checks.filter((check) => check.score !== null).length;
  return (
    availabilityLabel(factor.availability, audit.store) ??
    (firstIssue
      ? `${firstIssue.label}: ${firstIssue.detail}`
      : `${scored} of ${factor.checks.length} checks scored`)
  );
};

const factorLines = (audit: AppAuditResult): string[] => [
  "## Factors",
  "",
  "| Factor | Score | Status | Notes |",
  "| --- | --- | --- | --- |",
  ...audit.factors.map(
    (factor) =>
      `| ${escapeMarkdown(factor.label)} | ${
        factor.score === null ? DASH : `${factor.score}/10`
      } | ${STATUS_LABEL[scoreStatus(factor.score)]} | ${escapeMarkdown(
        factorNotes(factor, audit),
      )} |`,
  ),
  "",
];

const planLines = (audit: AppAuditResult): string[] =>
  BUCKETS.flatMap((bucket) => {
    const items = audit.recommendations[bucket];
    return [
      `## ${BUCKET_LABEL[bucket]}`,
      "",
      ...(items.length === 0
        ? [`No change is waiting in ${BUCKET_LABEL[bucket]}.`, ""]
        : items.flatMap(recommendationLines)),
    ];
  });

const benchmarkLines = (audit: AppAuditResult): string[] =>
  audit.benchmarks
    ? [
        "## Competitor comparison",
        "",
        `Compared with ${audit.benchmarks.competitors} competitors.`,
        "",
        "| Metric | You | Competitor median | Best | |",
        "| --- | --- | --- | --- | --- |",
        ...audit.benchmarks.rows.map(
          (row) =>
            `| ${escapeMarkdown(row.label)} | ${row.you ?? DASH} | ${
              row.median ?? DASH
            } | ${row.best ?? DASH} | ${COMPARISON_LABEL[comparison(row)]} |`,
        ),
        "",
      ]
    : [];

const limitationLines = (audit: AppAuditResult): string[] => {
  const limitations = audit.limitations ?? [];
  if (limitations.length === 0) return [];
  return [
    "## What this audit cannot see",
    "",
    ...limitations.map(
      (limitation) =>
        `- **${escapeMarkdown(limitation.label)}**: ${escapeMarkdown(
          limitation.detail,
        )}`,
    ),
    "",
  ];
};

export function auditMarkdown(
  audit: AppAuditResult,
  app: { name: string | null; country: string },
): string {
  return [
    `# ASO audit: ${escapeMarkdown(app.name ?? "this app")}`,
    "",
    `${storeLabel(audit.store)} · ${app.country.toUpperCase()} · ${audit.generatedAt.slice(0, 10)}`,
    "",
    headline(audit),
    "",
    ...groupLines(audit),
    ...factorLines(audit),
    ...planLines(audit),
    ...benchmarkLines(audit),
    ...limitationLines(audit),
  ].join("\n");
}
