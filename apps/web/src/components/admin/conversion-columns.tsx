"use client";

import { createColumnHelper } from "@tanstack/react-table";
import {
  PLANS,
  type AdminCohortWeek,
  type AdminDeparture,
} from "@asobeast/shared";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import {
  DEPARTURE_REASON_LABELS,
  WORKSPACE_STAGE_LABELS,
} from "@/lib/admin-stages";
import { formatDate, formatDayMonth, formatNumber } from "@/lib/format";

const cohortHelper = createColumnHelper<DataTableFeatures, AdminCohortWeek>();

const count = (id: keyof Omit<AdminCohortWeek, "weekStart">, label: string) =>
  cohortHelper.accessor((week) => week[id] ?? 0, {
    id,
    meta: { label, numeric: true },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="numeric">{formatNumber(getValue())}</span>
    ),
  });

export const cohortColumns = (billing: boolean) =>
  cohortHelper.columns([
    cohortHelper.accessor("weekStart", {
      id: "week",
      meta: { label: "Week of" },
      header: () => "Week of",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{formatDayMonth(getValue())}</span>
      ),
    }),
    count("signedUp", "Signed up"),
    count("confirmedEmail", "Confirmed"),
    ...(billing ? [count("trialStarted", "Trial")] : []),
    count("firstApp", "First app"),
    ...(billing
      ? [count("paid", "Paid"), count("stillPaying", "Still paying")]
      : []),
  ]);

const departureHelper = createColumnHelper<DataTableFeatures, AdminDeparture>();

const day = (id: "erasedOn" | "createdOn" | "requestedOn", label: string) =>
  departureHelper.accessor(id, {
    id,
    meta: { label },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap">{formatDate(getValue())}</span>
    ),
  });

const size = (id: "apps" | "keywordMarkets" | "members", label: string) =>
  departureHelper.accessor(id, {
    id,
    meta: { label, numeric: true },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="numeric">{formatNumber(getValue())}</span>
    ),
  });

export const departureColumns = (billing: boolean) =>
  departureHelper.columns([
    day("erasedOn", "Erased"),
    day("requestedOn", "Asked to leave"),
    day("createdOn", "Created"),
    ...(billing
      ? [
          departureHelper.accessor("stage", {
            id: "stage",
            meta: { label: "Stage" },
            header: () => "Stage",
            cell: ({ row }) => (
              <div className="flex flex-col">
                <span>{WORKSPACE_STAGE_LABELS[row.original.stage]}</span>
                <span className="text-caption text-muted-foreground">
                  {row.original.everPaid
                    ? `${PLANS[row.original.plan].displayName} · paid before`
                    : PLANS[row.original.plan].displayName}
                </span>
              </div>
            ),
          }),
        ]
      : []),
    size("apps", "Apps"),
    size("keywordMarkets", "Keyword markets"),
    size("members", "Members"),
    departureHelper.accessor("reason", {
      id: "reason",
      meta: { label: "Reason" },
      header: () => "Reason",
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">
          {DEPARTURE_REASON_LABELS[getValue() ?? "unanswered"]}
        </span>
      ),
    }),
  ]);
