"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useAppLocale } from "@/lib/use-app-locale";
import type { AppAuditResult, AuditRecommendation } from "@asobeast/shared";
import { LEDE } from "@/components/layout/panel-classes";
import { auditHistoryOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { fixesWorth } from "./audit-copy";
import { FIGURE } from "./layout-classes";
import { weekChange } from "./score-history";
import { topFixes } from "./top-fixes";
import { useAuditRange } from "./use-audit-range";

function WeekMove({ audit }: { audit: AppAuditResult }) {
  const t = useTranslations("audit");
  const { shownRange } = useAuditRange();
  const { data } = useSuspenseQuery(
    auditHistoryOptions(audit.appId, presetToRange(shownRange)),
  );
  const change = weekChange(data.points, audit);
  if (change === null) return null;
  if (change === 0) return <span>{t("lede.unchanged")}</span>;
  return (
    <>
      <span>{t(change > 0 ? "lede.up" : "lede.down")}</span>
      <span className={FIGURE}>{String(Math.abs(change))}</span>
      <span>{t("lede.sinceWeek")}</span>
    </>
  );
}

function TopFixesClause({ fixes }: { fixes: AuditRecommendation[] }) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  if (fixes.length === 0) {
    return <span>{t("lede.noFixes")}</span>;
  }
  const one = fixes.length === 1;
  const subject = one
    ? t("lede.oneFix")
    : t("lede.manyFixes", { count: fixes.length });
  const worth = fixesWorth(fixes, t);
  if (worth === null) {
    return (
      <>
        <span className={FIGURE}>{subject}</span>
        <span>{t(one ? "lede.oneListed" : "lede.manyListed")}</span>
      </>
    );
  }
  return (
    <>
      <span className={FIGURE}>{subject}</span>
      <span>{t(one ? "lede.oneWorth" : "lede.manyWorth")}</span>
      <span className={FIGURE}>{worth}</span>
      <span>{locale === "zh-CN" ? "。" : "."}</span>
    </>
  );
}

export function AuditLede({ audit }: { audit: AppAuditResult }) {
  const t = useTranslations("audit");
  const locale = useAppLocale();
  if (audit.overall === null) {
    return <p className={LEDE}>{t("lede.noScore")}</p>;
  }

  return (
    <p className={LEDE}>
      <span>{t("lede.score")}</span>
      <span className={FIGURE}>{String(Math.round(audit.overall))}</span>
      <Suspense fallback={null}>
        <WeekMove audit={audit} />
      </Suspense>
      <span>{locale === "zh-CN" ? "。" : ". "}</span>
      <TopFixesClause fixes={topFixes(audit.recommendations)} />
    </p>
  );
}
