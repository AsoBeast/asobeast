"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ADMIN_CONVERSION_WINDOWS,
  ADMIN_DEPARTURE_REASONS,
  STORES,
  TRIAL_ENDING_SOON_DAYS,
  WORKSPACE_STAGES,
  type AdminConversion,
  type AdminConversionWindow,
  type AdminOverview,
} from "@asobeast/shared";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import {
  departuresTitle,
  formatShare,
  funnelRows,
  medianLine,
  unrecordedNote,
} from "@/lib/admin-conversion";
import { adminHref } from "@/lib/admin-sections";
import {
  ADMIN_FLAG_LABELS,
  DEPARTURE_REASON_LABELS,
  WORKSPACE_STAGE_LABELS,
  countOf,
  flagHref,
  payingPlanLabel,
  stageHref,
} from "@/lib/admin-stages";
import { adminConversionWindowParser } from "@/lib/search-params";
import { formatNumber, pluralize, storeLabel } from "@/lib/format";
import { AdminPanel } from "./AdminPanel";
import { BreakdownList, type BreakdownRow } from "./BreakdownList";

export function WindowSegment({
  days,
  onChange,
}: {
  days: AdminConversionWindow;
  onChange: (days: AdminConversionWindow) => void;
}) {
  return (
    <Tabs
      value={String(days)}
      onValueChange={(next) =>
        onChange(
          adminConversionWindowParser.parse(next) ??
            ADMIN_CONVERSION_WINDOWS[0],
        )
      }
    >
      <TabsList aria-label="Sign up window">
        {ADMIN_CONVERSION_WINDOWS.map((window) => (
          <TabsOption key={window} value={String(window)}>
            {`${window}d`}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}

export function FunnelPanel({
  conversion,
  segment,
}: {
  conversion: AdminConversion;
  segment: ReactNode;
}) {
  const rows: BreakdownRow[] = funnelRows(conversion.funnel).map(
    (row, index) => ({
      key: row.key,
      label: row.label,
      count: row.count,
      share: row.ofFirst ?? 0,
      detail:
        index === 0
          ? undefined
          : row.ofPrevious === null
            ? "—"
            : formatShare(row.ofPrevious),
    }),
  );
  const medians = medianLine(conversion.medianDays);
  const note = unrecordedNote(
    conversion.departuresRecordedSince,
    conversion.days,
    conversion.generatedAt,
  );

  return (
    <AdminPanel
      title="Funnel"
      action={segment}
      footer={
        <span className="flex flex-col gap-1">
          <span>
            {medians ??
              `Workspaces signed up in the last ${pluralize(conversion.days, "day")}.`}
          </span>
          {note ? <span>{note}</span> : null}
        </span>
      }
    >
      <BreakdownList
        label="Sign up to paid"
        rows={rows}
        heads={{
          label: "Step",
          detail: "Of the step before",
          count: "Workspaces",
        }}
      />
    </AdminPanel>
  );
}

export function NeedsALookPanel({
  overview,
  conversion,
}: {
  overview: AdminOverview;
  conversion: AdminConversion;
}) {
  const { workspaces } = overview;
  const billingRows: BreakdownRow[] = [
    {
      key: "ending-soon",
      label: ADMIN_FLAG_LABELS["ending-soon"],
      count: conversion.trials?.endingSoon ?? 0,
      href: flagHref("ending-soon"),
    },
    {
      key: "canceling",
      label: ADMIN_FLAG_LABELS.canceling,
      count: workspaces.canceling ?? 0,
      href: flagHref("canceling"),
    },
    {
      key: "payment-failed",
      label: WORKSPACE_STAGE_LABELS["payment-failed"],
      count: countOf(workspaces.byStage, "payment-failed"),
      href: stageHref("payment-failed"),
    },
  ];
  const rows: BreakdownRow[] = [
    ...(overview.billing ? billingRows : []),
    {
      key: "deleting",
      label: ADMIN_FLAG_LABELS.deleting,
      count: workspaces.pendingDeletion,
      href: flagHref("deleting"),
    },
    {
      key: "suspended",
      label: ADMIN_FLAG_LABELS.suspended,
      count: workspaces.suspended,
      href: flagHref("suspended"),
    },
  ];

  return (
    <AdminPanel
      title="Needs a look"
      footer={
        overview.billing
          ? `Saves still possible: trials ending within ${TRIAL_ENDING_SOON_DAYS} days, renewals stopping and failed charges.`
          : "Workspaces that will leave or have lost access."
      }
    >
      <BreakdownList label="Workspaces that need a look" rows={rows} />
    </AdminPanel>
  );
}

export function StagesPanel({ overview }: { overview: AdminOverview }) {
  const total = overview.workspaces.total;
  const rows: BreakdownRow[] = WORKSPACE_STAGES.filter(
    (stage) => stage !== "self-hosted",
  ).map((stage) => {
    const count = countOf(overview.workspaces.byStage, stage);
    return {
      key: stage,
      label: WORKSPACE_STAGE_LABELS[stage],
      count,
      share: total === 0 ? 0 : count / total,
      href: stageHref(stage),
    };
  });

  return (
    <AdminPanel
      title="Workspaces by stage"
      footer="Where each workspace stands with billing right now."
    >
      <BreakdownList label="Workspaces by stage" rows={rows} />
    </AdminPanel>
  );
}

export function PayingPanel({
  payingByPlan,
}: {
  payingByPlan: NonNullable<AdminOverview["workspaces"]["payingByPlan"]>;
}) {
  const paying = payingByPlan.reduce((total, row) => total + row.count, 0);
  const rows: BreakdownRow[] = payingByPlan.map((row) => ({
    key: `${row.plan}-${row.interval ?? "unrecorded"}`,
    label: payingPlanLabel(row.plan, row.interval),
    count: row.count,
    share: paying === 0 ? 0 : row.count / paying,
  }));

  return (
    <AdminPanel
      title="Paying by plan and interval"
      footer="Paying workspaces by the plan they hold and how often it renews."
    >
      {paying > 0 ? (
        <BreakdownList label="Paying by plan and interval" rows={rows} />
      ) : (
        <EmptyState title="No workspace is paying right now." />
      )}
    </AdminPanel>
  );
}

export function InstancePanel({ overview }: { overview: AdminOverview }) {
  const { apps, keywords, activation } = overview;
  const rows: BreakdownRow[] = [
    {
      key: "apps",
      label: "Tracked apps",
      count: apps.tracked,
      detail: pluralize(apps.competitors, "competitor"),
    },
    ...STORES.map((store) => ({
      key: store,
      label: storeLabel(store),
      count: countOf(apps.byStore, store),
    })),
    {
      key: "markets",
      label: "Keyword markets",
      count: keywords.trackedMarkets,
      detail: pluralize(keywords.storefronts, "storefront"),
    },
    {
      key: "searched",
      label: "Searched keywords",
      count: keywords.searched,
    },
    {
      key: "ai",
      label: "AI calls this month",
      count: overview.aiCallsThisMonth,
    },
    ...(overview.billing && activation
      ? [
          {
            key: "activation",
            label: "Ranked within a day of import",
            count: activation.rankedWithinADay,
            detail: `of ${formatNumber(activation.importedLast30Days)}`,
          },
        ]
      : []),
  ];

  return (
    <AdminPanel
      title="Instance"
      footer="Tracked apps leave competitors aside; activation counts the last 30 days."
    >
      <BreakdownList label="Instance totals" rows={rows} />
    </AdminPanel>
  );
}

export function DeparturesPanel({
  conversion,
}: {
  conversion: AdminConversion;
}) {
  const { departures } = conversion;
  const reasons: BreakdownRow[] = ADMIN_DEPARTURE_REASONS.map((reason) => {
    const count = countOf(departures.byReason, reason);
    return {
      key: reason,
      label: DEPARTURE_REASON_LABELS[reason],
      count,
      share: departures.total === 0 ? 0 : count / departures.total,
    };
  }).filter((row) => row.count > 0);
  const stages = WORKSPACE_STAGES.flatMap((stage) => {
    const count = countOf(departures.byStage, stage);
    return count > 0
      ? [
          `${formatNumber(count)} ${WORKSPACE_STAGE_LABELS[stage].toLowerCase()}`,
        ]
      : [];
  });

  return (
    <AdminPanel
      title={departuresTitle(conversion.days)}
      footer={
        <span className="flex w-full flex-wrap items-center justify-between gap-2">
          <span>
            {departures.total > 0
              ? `By stage when they asked to leave: ${stages.join(" · ")}.`
              : "Erased workspaces, by the reason they chose."}
          </span>
          <Link href={adminHref("conversion")} className={FOOTER_LINK}>
            See every departure
          </Link>
        </span>
      }
    >
      {reasons.length > 0 ? (
        <BreakdownList
          label="Why workspaces left"
          rows={reasons}
          heads={{ label: "Reason", count: "Workspaces" }}
        />
      ) : (
        <EmptyState
          title={`No workspace was erased in the last ${pluralize(conversion.days, "day")}.`}
        />
      )}
    </AdminPanel>
  );
}
