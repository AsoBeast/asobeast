import type {
  AppAuditResult,
  AuditRecommendation,
  AuditRecommendations,
} from "@asobeast/shared";
import {
  availabilityLabel,
  BUCKET_LABEL,
  EFFORT_LABEL,
  gradeLabel,
  GROUP_LABEL,
  IMPACT_LABEL,
  liftLabel,
  percent,
  STATUS_LABEL,
  STORE_LABEL,
} from "./audit-copy";
import { comparison, COMPARISON_LABEL } from "./benchmark-comparison";

const BUCKET_HEADINGS: Record<keyof AuditRecommendations, string> = {
  quickWins: "Quick wins (today)",
  highImpact: "High impact (this week)",
  strategic: "Strategic (this month)",
};

export const escapePipes = (text: string): string =>
  text.replaceAll("|", "\\|");

const factorStatus = (score: number | null): string => {
  if (score === null) return STATUS_LABEL.unanswered;
  if (score >= 7) return STATUS_LABEL.pass;
  return score >= 4 ? STATUS_LABEL.warn : STATUS_LABEL.fail;
};

const recommendationLines = (item: AuditRecommendation): string[] => [
  `### ${escapePipes(item.label)} · ${liftLabel(item.lift)}`,
  "",
  `${item.impact ? IMPACT_LABEL[item.impact] : "Impact unknown"} · ${
    item.effort ? EFFORT_LABEL[item.effort] : "Effort unknown"
  }`,
  "",
  escapePipes(item.detail),
  ...(item.fix ? ["", escapePipes(item.fix)] : []),
  "",
];

export function auditMarkdown(
  audit: AppAuditResult,
  app: { name: string | null; country: string },
): string {
  const lines: string[] = [
    `# ASO audit: ${escapePipes(app.name ?? "this app")}`,
    "",
    `${STORE_LABEL[audit.store]} · ${app.country.toUpperCase()} · ${audit.generatedAt.slice(0, 10)}`,
    "",
    `**${audit.overall === null ? "—" : Math.round(audit.overall)}/100 · Grade ${
      audit.grade ?? "—"
    }, ${gradeLabel(audit.grade)} · ${percent(audit.confidence ?? 0)}% measured · Potential ${
      audit.potential === null || audit.potential === undefined
        ? "—"
        : Math.round(audit.potential)
    }**`,
    "",
  ];

  for (const group of audit.groups ?? []) {
    lines.push(
      `- ${GROUP_LABEL[group.id]}: ${group.score === null ? "—" : group.score}/10`,
    );
  }
  if ((audit.groups ?? []).length > 0) lines.push("");

  lines.push(
    "## Factors",
    "",
    "| Factor | Score | Status | Notes |",
    "| --- | --- | --- | --- |",
  );
  for (const factor of audit.factors) {
    const firstIssue = factor.checks.find(
      (check) => check.status === "warn" || check.status === "fail",
    );
    const notes =
      availabilityLabel(factor.availability, audit.store) ??
      (firstIssue
        ? `${firstIssue.label}: ${firstIssue.detail}`
        : `${factor.checks.filter((check) => check.score !== null).length} of ${factor.checks.length} checks scored`);
    lines.push(
      `| ${escapePipes(factor.label)} | ${
        factor.score === null ? "—" : `${factor.score}/10`
      } | ${factorStatus(factor.score)} | ${escapePipes(notes)} |`,
    );
  }
  lines.push("");

  for (const bucket of ["quickWins", "highImpact", "strategic"] as const) {
    lines.push(`## ${BUCKET_HEADINGS[bucket]}`, "");
    const items = audit.recommendations[bucket];
    if (items.length === 0) {
      lines.push(`No change is waiting in ${BUCKET_LABEL[bucket]}.`, "");
      continue;
    }
    for (const item of items) lines.push(...recommendationLines(item));
  }

  if (audit.benchmarks) {
    lines.push(
      "## Competitor comparison",
      "",
      `Compared with ${audit.benchmarks.competitors} competitors.`,
      "",
      "| Metric | You | Competitor median | Best | |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const row of audit.benchmarks.rows) {
      lines.push(
        `| ${escapePipes(row.label)} | ${row.you ?? "—"} | ${row.median ?? "—"} | ${
          row.best ?? "—"
        } | ${COMPARISON_LABEL[comparison(row)]} |`,
      );
    }
    lines.push("");
  }

  if ((audit.limitations ?? []).length > 0) {
    lines.push("## What this audit cannot see", "");
    for (const limitation of audit.limitations ?? []) {
      lines.push(
        `- **${escapePipes(limitation.label)}**: ${escapePipes(limitation.detail)}`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
