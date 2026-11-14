"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
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
  const { shownRange } = useAuditRange();
  const { data } = useSuspenseQuery(
    auditHistoryOptions(audit.appId, presetToRange(shownRange)),
  );
  const change = weekChange(data.points, audit);
  if (change === null) return null;
  if (change === 0) return <span>, unchanged since last week</span>;
  return (
    <>
      <span>{change > 0 ? ", up " : ", down "}</span>
      <span className={FIGURE}>{String(Math.abs(change))}</span>
      <span> since last week</span>
    </>
  );
}

function TopFixesClause({ fixes }: { fixes: AuditRecommendation[] }) {
  if (fixes.length === 0) {
    return <span>No change is waiting on you right now.</span>;
  }
  const one = fixes.length === 1;
  const subject = one ? "The top fix" : `The top ${fixes.length} fixes`;
  const worth = fixesWorth(fixes);
  if (worth === null) {
    return (
      <>
        <span className={FIGURE}>{subject}</span>
        <span>{one ? " is listed below." : " are listed below."}</span>
      </>
    );
  }
  return (
    <>
      <span className={FIGURE}>{subject}</span>
      <span>{one ? " is worth " : " are worth "}</span>
      <span className={FIGURE}>{worth}</span>
      <span>.</span>
    </>
  );
}

export function AuditLede({ audit }: { audit: AppAuditResult }) {
  if (audit.overall === null) {
    return <p className={LEDE}>The score is not available yet.</p>;
  }

  return (
    <p className={LEDE}>
      <span>Score </span>
      <span className={FIGURE}>{String(Math.round(audit.overall))}</span>
      <Suspense fallback={null}>
        <WeekMove audit={audit} />
      </Suspense>
      <span>. </span>
      <TopFixesClause fixes={topFixes(audit.recommendations)} />
    </p>
  );
}
