"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { AppAuditResult } from "@asobeast/shared";
import { LEDE } from "@/components/layout/panel-classes";
import { pluralize } from "@/lib/format";
import { auditHistoryOptions } from "@/lib/queries";
import { presetToRange } from "@/lib/ranges";
import { fixesWorth } from "./audit-copy";
import { FIGURE } from "./layout-classes";
import { weekChange } from "./score-history";
import { topFixes } from "./top-fixes";
import { useAuditRange } from "./use-audit-range";

function WeekMove({ id }: { id: string }) {
  const { shownRange } = useAuditRange();
  const { data } = useSuspenseQuery(
    auditHistoryOptions(id, presetToRange(shownRange)),
  );
  const change = weekChange(data.points);
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

export function AuditLede({ audit }: { audit: AppAuditResult }) {
  const fixes = topFixes(audit.recommendations);

  if (audit.overall === null) {
    return <p className={LEDE}>The score is not available yet.</p>;
  }

  return (
    <p className={LEDE}>
      <span>Score </span>
      <span className={FIGURE}>{String(Math.round(audit.overall))}</span>
      <Suspense fallback={null}>
        <WeekMove id={audit.appId} />
      </Suspense>
      <span>. </span>
      {fixes.length === 0 ? (
        <span>No change is waiting on you right now.</span>
      ) : (
        <>
          <span className={FIGURE}>
            {pluralize(fixes.length, "fix", "fixes")}
          </span>
          <span>{fixes.length === 1 ? " is worth " : " are worth "}</span>
          <span className={FIGURE}>{fixesWorth(fixes)}</span>
          <span>.</span>
        </>
      )}
    </p>
  );
}
