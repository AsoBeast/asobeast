"use client";

import { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { ADMIN_COHORT_WEEKS } from "@asobeast/shared";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { PANEL_BLEED } from "@/components/layout/panel-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { CONVERSION_TAB_WINDOW } from "@/lib/admin-conversion";
import { formatDateInLocale } from "@/lib/format";
import { adminConversionOptions, adminDeparturesOptions } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { AdminPanel } from "./AdminPanel";
import { AdminTable } from "./AdminTable";
import { cohortColumns, departureColumns } from "./conversion-columns";
import { ListPanelSkeleton } from "./skeletons";

function CohortsPanel() {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const { data: conversion } = useSuspenseQuery(
    adminConversionOptions(CONVERSION_TAB_WINDOW),
  );
  const columns = useMemo(
    () => cohortColumns(conversion.billing, { translator: t, locale }),
    [conversion.billing, t, locale],
  );
  const table = useTable({
    features: dataTableFeatures,
    data: conversion.cohorts,
    columns,
    getRowId: (week) => week.weekStart,
  });
  const signups = conversion.cohorts.reduce(
    (total, week) => total + week.signedUp,
    0,
  );

  return (
    <AdminPanel
      title={t("conversion.cohorts.title")}
      contentClassName={PANEL_BLEED}
      footer={t("conversion.cohorts.footer", {
        count: signups,
        weeks: ADMIN_COHORT_WEEKS,
      })}
    >
      {signups > 0 ? (
        <AdminTable
          table={table}
          caption={t("conversion.cohorts.caption")}
          scrollLabel={t("conversion.cohorts.title")}
        />
      ) : (
        <EmptyState
          title={t("conversion.cohorts.empty", {
            weeks: ADMIN_COHORT_WEEKS,
          })}
        />
      )}
    </AdminPanel>
  );
}

function DeparturesListPanel() {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const { data: conversion } = useSuspenseQuery(
    adminConversionOptions(CONVERSION_TAB_WINDOW),
  );
  const { data: departures } = useSuspenseQuery(adminDeparturesOptions);
  const columns = useMemo(
    () => departureColumns(conversion.billing, { translator: t, locale }),
    [conversion.billing, t, locale],
  );
  const table = useTable({
    features: dataTableFeatures,
    data: departures.items,
    columns,
    getRowId: (departure) => departure.id,
  });
  const since = conversion.departuresRecordedSince;

  return (
    <AdminPanel
      title={t("conversion.departures.title")}
      contentClassName={PANEL_BLEED}
      footer={[
        departures.total > departures.items.length
          ? t("conversion.departures.truncated", {
              shown: departures.items.length,
              total: departures.total,
            })
          : t("conversion.departures.all", { count: departures.total }),
        since
          ? t("conversion.departures.before", {
              date: formatDateInLocale(since, locale),
            })
          : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {departures.items.length > 0 ? (
        <AdminTable
          table={table}
          caption={t("conversion.departures.caption")}
          scrollLabel={t("conversion.departures.title")}
        />
      ) : (
        <EmptyState
          title={
            since
              ? t("conversion.departures.emptySince", {
                  date: formatDateInLocale(since, locale),
                })
              : t("conversion.departures.empty")
          }
        />
      )}
    </AdminPanel>
  );
}

export function AdminConversion() {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<ListPanelSkeleton rows={8} />}>
        <CohortsPanel />
      </Suspense>
      <Suspense fallback={<ListPanelSkeleton rows={3} />}>
        <DeparturesListPanel />
      </Suspense>
    </div>
  );
}
