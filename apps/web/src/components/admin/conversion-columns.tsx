"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { AdminCohortWeek, AdminDeparture } from "@asobeast/shared";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import type { TranslationContext } from "@/i18n/translator";
import { departureReasonLabel, workspaceStageLabel } from "@/lib/admin-stages";
import {
  formatDateInLocale,
  formatDayMonthInLocale,
  formatNumberInLocale,
} from "@/lib/format";

const cohortHelper = createColumnHelper<DataTableFeatures, AdminCohortWeek>();

const count = (
  id: keyof Omit<AdminCohortWeek, "weekStart">,
  label: string,
  locale: TranslationContext["locale"],
) =>
  cohortHelper.accessor((week) => week[id] ?? 0, {
    id,
    meta: { label, numeric: true },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="numeric">
        {formatNumberInLocale(getValue(), locale)}
      </span>
    ),
  });

export const cohortColumns = (
  billing: boolean,
  context: TranslationContext,
) => {
  const t = context.translator;
  return cohortHelper.columns([
    cohortHelper.accessor("weekStart", {
      id: "week",
      meta: { label: t("conversion.cohorts.columns.week") },
      header: () => t("conversion.cohorts.columns.week"),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">
          {formatDayMonthInLocale(getValue(), context.locale)}
        </span>
      ),
    }),
    count("signedUp", t("conversion.cohorts.columns.signedUp"), context.locale),
    count(
      "confirmedEmail",
      t("conversion.cohorts.columns.confirmed"),
      context.locale,
    ),
    ...(billing
      ? [
          count(
            "trialStarted",
            t("conversion.cohorts.columns.trial"),
            context.locale,
          ),
        ]
      : []),
    count("firstApp", t("conversion.cohorts.columns.firstApp"), context.locale),
    ...(billing
      ? [
          count("paid", t("conversion.cohorts.columns.paid"), context.locale),
          count(
            "stillPaying",
            t("conversion.cohorts.columns.stillPaying"),
            context.locale,
          ),
        ]
      : []),
  ]);
};

const departureHelper = createColumnHelper<DataTableFeatures, AdminDeparture>();

const day = (
  id: "erasedOn" | "createdOn" | "requestedOn",
  label: string,
  locale: TranslationContext["locale"],
) =>
  departureHelper.accessor(id, {
    id,
    meta: { label },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap">
        {formatDateInLocale(getValue(), locale)}
      </span>
    ),
  });

const size = (
  id: "apps" | "keywordMarkets" | "members",
  label: string,
  locale: TranslationContext["locale"],
) =>
  departureHelper.accessor(id, {
    id,
    meta: { label, numeric: true },
    header: () => label,
    cell: ({ getValue }) => (
      <span className="numeric">
        {formatNumberInLocale(getValue(), locale)}
      </span>
    ),
  });

export const departureColumns = (
  billing: boolean,
  context: TranslationContext,
) => {
  const t = context.translator;
  return departureHelper.columns([
    day("erasedOn", t("conversion.departures.columns.erased"), context.locale),
    day(
      "requestedOn",
      t("conversion.departures.columns.requested"),
      context.locale,
    ),
    day(
      "createdOn",
      t("conversion.departures.columns.created"),
      context.locale,
    ),
    ...(billing
      ? [
          departureHelper.accessor("stage", {
            id: "stage",
            meta: { label: t("conversion.departures.columns.stage") },
            header: () => t("conversion.departures.columns.stage"),
            cell: ({ row }) => (
              <div className="flex flex-col">
                <span>{workspaceStageLabel(row.original.stage, t)}</span>
                <span className="text-caption text-muted-foreground">
                  {row.original.everPaid
                    ? t("conversion.departures.paidPlan", {
                        plan: t(`plans.${row.original.plan}`),
                        paidBefore: t("conversion.departures.paidBefore"),
                      })
                    : t(`plans.${row.original.plan}`)}
                </span>
              </div>
            ),
          }),
        ]
      : []),
    size("apps", t("conversion.departures.columns.apps"), context.locale),
    size(
      "keywordMarkets",
      t("conversion.departures.columns.keywordMarkets"),
      context.locale,
    ),
    size("members", t("conversion.departures.columns.members"), context.locale),
    departureHelper.accessor("reason", {
      id: "reason",
      meta: { label: t("conversion.departures.columns.reason") },
      header: () => t("conversion.departures.columns.reason"),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">
          {departureReasonLabel(getValue() ?? "unanswered", t)}
        </span>
      ),
    }),
  ]);
};
