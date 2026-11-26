"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  countOf,
  departureReasonLabel,
  flagHref,
  payingPlanLabel,
  stageHref,
  workspaceFlagLabel,
  workspaceStageLabel,
} from "@/lib/admin-stages";
import { adminConversionWindowParser } from "@/lib/search-params";
import { storeLabel } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { AdminPanel } from "./AdminPanel";
import { BreakdownList, type BreakdownRow } from "./BreakdownList";

export function WindowSegment({
  days,
  onChange,
}: {
  days: AdminConversionWindow;
  onChange: (days: AdminConversionWindow) => void;
}) {
  const t = useTranslations("admin");
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
      <TabsList aria-label={t("conversion.window")}>
        {ADMIN_CONVERSION_WINDOWS.map((window) => (
          <TabsOption key={window} value={String(window)}>
            {t("conversion.days", { count: window })}
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
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const rows: BreakdownRow[] = funnelRows(conversion.funnel, t).map(
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
            : formatShare(row.ofPrevious, locale),
    }),
  );
  const medians = medianLine(conversion.medianDays, t);
  const note = unrecordedNote(
    conversion.departuresRecordedSince,
    conversion.days,
    conversion.generatedAt,
    { translator: t, locale },
  );

  return (
    <AdminPanel
      title={t("conversion.title")}
      action={segment}
      footer={
        <span className="flex flex-col gap-1">
          <span>
            {medians ?? t("conversion.fallback", { days: conversion.days })}
          </span>
          {note ? <span>{note}</span> : null}
        </span>
      }
    >
      <BreakdownList
        label={t("conversion.list")}
        rows={rows}
        heads={{
          label: t("conversion.columns.step"),
          detail: t("conversion.columns.previous"),
          count: t("conversion.columns.workspaces"),
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
  const t = useTranslations("admin");
  const { workspaces } = overview;
  const billingRows: BreakdownRow[] = [
    {
      key: "ending-soon",
      label: workspaceFlagLabel("ending-soon", t),
      count: conversion.trials?.endingSoon ?? 0,
      href: flagHref("ending-soon"),
    },
    {
      key: "canceling",
      label: workspaceFlagLabel("canceling", t),
      count: workspaces.canceling ?? 0,
      href: flagHref("canceling"),
    },
    {
      key: "payment-failed",
      label: workspaceStageLabel("payment-failed", t),
      count: countOf(workspaces.byStage, "payment-failed"),
      href: stageHref("payment-failed"),
    },
  ];
  const rows: BreakdownRow[] = [
    ...(overview.billing ? billingRows : []),
    {
      key: "deleting",
      label: workspaceFlagLabel("deleting", t),
      count: workspaces.pendingDeletion,
      href: flagHref("deleting"),
    },
    {
      key: "suspended",
      label: workspaceFlagLabel("suspended", t),
      count: workspaces.suspended,
      href: flagHref("suspended"),
    },
  ];

  return (
    <AdminPanel
      title={t("conversion.needsLook")}
      footer={
        overview.billing
          ? t("conversion.billingFooter", { days: TRIAL_ENDING_SOON_DAYS })
          : t("conversion.selfHostedFooter")
      }
    >
      <BreakdownList label={t("conversion.needsLookList")} rows={rows} />
    </AdminPanel>
  );
}

export function StagesPanel({ overview }: { overview: AdminOverview }) {
  const t = useTranslations("admin");
  const total = overview.workspaces.total;
  const rows: BreakdownRow[] = WORKSPACE_STAGES.filter(
    (stage) => stage !== "self-hosted",
  ).map((stage) => {
    const count = countOf(overview.workspaces.byStage, stage);
    return {
      key: stage,
      label: workspaceStageLabel(stage, t),
      count,
      share: total === 0 ? 0 : count / total,
      href: stageHref(stage),
    };
  });

  return (
    <AdminPanel
      title={t("conversion.stagesTitle")}
      footer={t("conversion.stagesFooter")}
    >
      <BreakdownList label={t("conversion.stagesTitle")} rows={rows} />
    </AdminPanel>
  );
}

export function PayingPanel({
  payingByPlan,
}: {
  payingByPlan: NonNullable<AdminOverview["workspaces"]["payingByPlan"]>;
}) {
  const t = useTranslations("admin");
  const paying = payingByPlan.reduce((total, row) => total + row.count, 0);
  const rows: BreakdownRow[] = payingByPlan.map((row) => ({
    key: `${row.plan}-${row.interval ?? "unrecorded"}`,
    label: payingPlanLabel(row.plan, row.interval, t),
    count: row.count,
    share: paying === 0 ? 0 : row.count / paying,
  }));

  return (
    <AdminPanel
      title={t("conversion.payingTitle")}
      footer={t("conversion.payingFooter")}
    >
      {paying > 0 ? (
        <BreakdownList label={t("conversion.payingTitle")} rows={rows} />
      ) : (
        <EmptyState title={t("conversion.payingEmpty")} />
      )}
    </AdminPanel>
  );
}

export function InstancePanel({ overview }: { overview: AdminOverview }) {
  const t = useTranslations("admin");
  const { apps, keywords, activation } = overview;
  const rows: BreakdownRow[] = [
    {
      key: "apps",
      label: t("conversion.trackedApps"),
      count: apps.tracked,
      detail: t("common.competitorCount", { count: apps.competitors }),
    },
    ...STORES.map((store) => ({
      key: store,
      label: storeLabel(store),
      count: countOf(apps.byStore, store),
    })),
    {
      key: "markets",
      label: t("conversion.keywordMarkets"),
      count: keywords.trackedMarkets,
      detail: t("common.storefrontCount", { count: keywords.storefronts }),
    },
    {
      key: "searched",
      label: t("conversion.searchedKeywords"),
      count: keywords.searched,
    },
    {
      key: "ai",
      label: t("conversion.aiCalls"),
      count: overview.aiCallsThisMonth,
    },
    ...(overview.billing && activation
      ? [
          {
            key: "activation",
            label: t("conversion.rankedWithinDay"),
            count: activation.rankedWithinADay,
            detail: t("overview.of", { count: activation.importedLast30Days }),
          },
        ]
      : []),
  ];

  return (
    <AdminPanel
      title={t("conversion.instanceTitle")}
      footer={t("conversion.instanceFooter")}
    >
      <BreakdownList label={t("conversion.instanceList")} rows={rows} />
    </AdminPanel>
  );
}

export function DeparturesPanel({
  conversion,
}: {
  conversion: AdminConversion;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const { departures } = conversion;
  const reasons: BreakdownRow[] = ADMIN_DEPARTURE_REASONS.map((reason) => {
    const count = countOf(departures.byReason, reason);
    return {
      key: reason,
      label: departureReasonLabel(reason, t),
      count,
      share: departures.total === 0 ? 0 : count / departures.total,
    };
  }).filter((row) => row.count > 0);
  const stages = WORKSPACE_STAGES.flatMap((stage) => {
    const count = countOf(departures.byStage, stage);
    return count > 0
      ? [
          t("conversion.departureStage", {
            count,
            stage: workspaceStageLabel(stage, t).toLocaleLowerCase(locale),
          }),
        ]
      : [];
  });
  const stageList = stages.join(t("conversion.departureStageSeparator"));

  return (
    <AdminPanel
      title={departuresTitle(conversion.days, t)}
      footer={
        <span className="flex w-full flex-wrap items-center justify-between gap-2">
          <span>
            {departures.total > 0
              ? t("conversion.departureStages", { stages: stageList })
              : t("conversion.departuresEmptyFooter")}
          </span>
          <Link href={adminHref("conversion")} className={FOOTER_LINK}>
            {t("conversion.seeAllDepartures")}
          </Link>
        </span>
      }
    >
      {reasons.length > 0 ? (
        <BreakdownList
          label={t("conversion.reasonsList")}
          rows={reasons}
          heads={{
            label: t("conversion.reason"),
            count: t("conversion.columns.workspaces"),
          }}
        />
      ) : (
        <EmptyState
          title={t("conversion.departureEmpty", { days: conversion.days })}
        />
      )}
    </AdminPanel>
  );
}
