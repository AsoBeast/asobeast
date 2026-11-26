import type {
  AppAuditResult,
  AuditFactorResult,
  AuditRecommendation,
} from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enAudit from "../../../messages/en/audit.json";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";
import {
  availabilityLabel,
  BUCKETS,
  gradeLabel,
  groupLabel,
  liftLabel,
  percent,
  scoreStatus,
} from "./audit-copy";
import { comparison, formatBenchmarkValue } from "./benchmark-comparison";

const english = createTranslator({
  locale: "en",
  namespace: "audit",
  messages: { audit: enAudit },
});

const DASH = "—";

const rounded = (value: number | null | undefined): string =>
  value === null || value === undefined ? DASH : String(Math.round(value));

export const escapeMarkdown = (text: string): string =>
  text
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|")
    .replace(/\s*\r?\n\s*/g, " ");

const recommendationLines = (
  item: AuditRecommendation,
  t: MessageTranslator,
): string[] => [
  `### ${escapeMarkdown(item.label)} · ${liftLabel(item.lift, t)}`,
  "",
  `${item.impact ? t(`impacts.${item.impact}`) : t("report.impactUnknown")} · ${
    item.effort ? t(`efforts.${item.effort}`) : t("report.effortUnknown")
  }`,
  "",
  escapeMarkdown(item.detail),
  ...(item.fix ? ["", escapeMarkdown(item.fix)] : []),
  "",
];

const headline = (audit: AppAuditResult, t: MessageTranslator): string =>
  `**${[
    `${rounded(audit.overall)}/100`,
    t("report.grade", {
      grade: audit.grade ?? DASH,
      label: gradeLabel(audit.grade, t),
    }),
    ...(audit.confidence === undefined
      ? []
      : [t("measuredShort", { percent: percent(audit.confidence) })]),
    t("report.potential", { score: rounded(audit.potential) }),
  ].join(" · ")}**`;

const groupLines = (audit: AppAuditResult, t: MessageTranslator): string[] => {
  const groups = audit.groups ?? [];
  if (groups.length === 0) return [];
  return [
    ...groups.map(
      (group) =>
        `- ${groupLabel(group.id, t)}: ${rounded(
          group.score === null ? null : group.score * 10,
        )}/100`,
    ),
    "",
  ];
};

const factorNotes = (
  factor: AuditFactorResult,
  audit: AppAuditResult,
  t: MessageTranslator,
): string => {
  const firstIssue = factor.checks.find(
    (check) => check.status === "warn" || check.status === "fail",
  );
  const scored = factor.checks.filter((check) => check.score !== null).length;
  return (
    availabilityLabel(factor.availability, audit.store, t) ??
    (firstIssue
      ? `${firstIssue.label}: ${firstIssue.detail}`
      : t("checksScored", { scored, total: factor.checks.length }))
  );
};

const factorLines = (audit: AppAuditResult, t: MessageTranslator): string[] => [
  `## ${t("factors")}`,
  "",
  t("report.factorTable"),
  t("report.factorDivider"),
  ...audit.factors.map(
    (factor) =>
      `| ${escapeMarkdown(factor.label)} | ${
        factor.score === null ? DASH : `${factor.score}/10`
      } | ${t(`statuses.${scoreStatus(factor.score)}`)} | ${escapeMarkdown(
        factorNotes(factor, audit, t),
      )} |`,
  ),
  "",
];

const planLines = (audit: AppAuditResult, t: MessageTranslator): string[] =>
  BUCKETS.flatMap((bucket) => {
    const items = audit.recommendations[bucket];
    const label = t(`buckets.${bucket}`);
    return [
      `## ${label}`,
      "",
      ...(items.length === 0
        ? [t("report.emptyBucket", { bucket: label }), ""]
        : items.flatMap((item) => recommendationLines(item, t))),
    ];
  });

const benchmarkLines = (
  audit: AppAuditResult,
  t: MessageTranslator,
): string[] =>
  audit.benchmarks
    ? [
        `## ${t("benchmarks.title")}`,
        "",
        t("report.benchmarkCompared", { count: audit.benchmarks.competitors }),
        "",
        t("report.benchmarkTable"),
        t("report.benchmarkDivider"),
        ...audit.benchmarks.rows.map(
          (row) =>
            `| ${escapeMarkdown(row.label)} | ${formatBenchmarkValue(
              row.metric,
              row.you,
            )} | ${formatBenchmarkValue(
              row.metric,
              row.median,
            )} | ${formatBenchmarkValue(row.metric, row.best)} | ${t(
              `benchmarks.${comparison(row)}`,
            )} |`,
        ),
        "",
      ]
    : [];

const limitationLines = (
  audit: AppAuditResult,
  t: MessageTranslator,
): string[] => {
  const limitations = audit.limitations ?? [];
  if (limitations.length === 0) return [];
  return [
    `## ${t("footer.title")}`,
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
  t: MessageTranslator = english,
): string {
  return [
    `# ${t("report.title", {
      name: escapeMarkdown(app.name ?? t("report.thisApp")),
    })}`,
    "",
    `${storeLabel(audit.store)} · ${app.country.toUpperCase()} · ${audit.generatedAt.slice(0, 10)}`,
    "",
    headline(audit, t),
    "",
    ...groupLines(audit, t),
    ...factorLines(audit, t),
    ...planLines(audit, t),
    ...benchmarkLines(audit, t),
    ...limitationLines(audit, t),
  ].join("\n");
}
