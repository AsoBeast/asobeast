"use client";

import { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTable } from "@tanstack/react-table";
import { ADMIN_COHORT_WEEKS } from "@asobeast/shared";
import { dataTableFeatures } from "@/components/data-table/table-features";
import { PANEL_BLEED } from "@/components/layout/panel-classes";
import { EmptyState } from "@/components/ui/empty-state";
import { CONVERSION_TAB_WINDOW } from "@/lib/admin-conversion";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { adminConversionOptions, adminDeparturesOptions } from "@/lib/queries";
import { AdminPanel } from "./AdminPanel";
import { AdminTable } from "./AdminTable";
import { cohortColumns, departureColumns } from "./conversion-columns";
import { ListPanelSkeleton } from "./skeletons";

function CohortsPanel() {
  const { data: conversion } = useSuspenseQuery(
    adminConversionOptions(CONVERSION_TAB_WINDOW),
  );
  const columns = useMemo(
    () => cohortColumns(conversion.billing),
    [conversion.billing],
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
      title="Weekly cohorts"
      contentClassName={PANEL_BLEED}
      footer={`${pluralize(signups, "sign up")} over ${ADMIN_COHORT_WEEKS} weeks, Monday to Sunday in UTC, each followed to today.`}
    >
      {signups > 0 ? (
        <AdminTable
          table={table}
          caption="Sign ups by week and how far each week got"
          scrollLabel="Weekly cohorts"
        />
      ) : (
        <EmptyState
          title={`No workspace signed up in the last ${ADMIN_COHORT_WEEKS} weeks.`}
        />
      )}
    </AdminPanel>
  );
}

function DeparturesListPanel() {
  const { data: conversion } = useSuspenseQuery(
    adminConversionOptions(CONVERSION_TAB_WINDOW),
  );
  const { data: departures } = useSuspenseQuery(adminDeparturesOptions);
  const columns = useMemo(
    () => departureColumns(conversion.billing),
    [conversion.billing],
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
      title="Departures"
      contentClassName={PANEL_BLEED}
      footer={[
        departures.total > departures.items.length
          ? `The newest ${formatNumber(departures.items.length)} of ${formatNumber(departures.total)} erased workspaces.`
          : `${pluralize(departures.total, "erased workspace")}, newest first, with nothing that names them.`,
        since
          ? `Workspaces erased before ${formatDate(since)} are not in this list.`
          : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {departures.items.length > 0 ? (
        <AdminTable
          table={table}
          caption="Erased workspaces, newest first"
          scrollLabel="Departures"
        />
      ) : (
        <EmptyState
          title={
            since
              ? `No workspace has been erased since ${formatDate(since)}.`
              : "No workspace has been erased yet."
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
