"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { AdminApp } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import type { TranslationContext } from "@/i18n/translator";
import { workspaceListHref } from "@/lib/admin-sections";
import {
  formatCountryInLocale,
  formatDateInLocale,
  formatNumberInLocale,
  storeLabel,
} from "@/lib/format";
import { NUMBER_SORT, WorkspaceName } from "./cells";

const columnHelper = createColumnHelper<DataTableFeatures, AdminApp>();

function AppName({
  app,
  context,
}: {
  app: AdminApp;
  context: TranslationContext;
}) {
  return (
    <div className="flex max-w-64 min-w-0 items-center gap-3">
      <AppIcon src={app.iconUrl} size={32} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {app.name ?? context.translator("common.untitledApp")}
        </span>
        <span
          className="truncate text-caption text-muted-foreground"
          translate="no"
        >
          {app.storeAppId}
        </span>
      </div>
    </div>
  );
}

const countCell = (value: number, locale: TranslationContext["locale"]) => (
  <span className="numeric">{formatNumberInLocale(value, locale)}</span>
);

export const appColumns = (context: TranslationContext) => {
  const t = context.translator;
  return columnHelper.columns([
    columnHelper.accessor((app) => app.name ?? "", {
      id: "name",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("apps.columns.app")} />
      ),
      cell: ({ row }) => <AppName app={row.original} context={context} />,
    }),
    columnHelper.accessor((app) => storeLabel(app.store), {
      id: "store",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: t("apps.columns.store"), phone: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("apps.columns.store")} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">{getValue()}</span>
      ),
    }),
    columnHelper.accessor(
      (app) => formatCountryInLocale(app.country, context.locale),
      {
        id: "market",
        sortFn: "text",
        sortDescFirst: false,
        meta: { label: t("apps.columns.market") },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("apps.columns.market")} />
        ),
        cell: ({ getValue }) => (
          <span className="whitespace-nowrap">{getValue()}</span>
        ),
      },
    ),
    columnHelper.accessor("workspaceName", {
      id: "workspace",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: t("apps.columns.workspace") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("apps.columns.workspace")} />
      ),
      cell: ({ row }) => (
        <WorkspaceName
          name={row.original.workspaceName}
          workspaceId={row.original.workspaceId}
          href={workspaceListHref("users", row.original.workspaceId)}
          title={t("apps.accountsTitle", {
            name: row.original.workspaceName,
          })}
        />
      ),
    }),
    columnHelper.accessor("competitors", {
      id: "competitors",
      ...NUMBER_SORT,
      meta: { label: t("apps.columns.competitors"), numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("apps.columns.competitors")} />
      ),
      cell: ({ getValue }) => countCell(getValue(), context.locale),
    }),
    columnHelper.accessor("keywordMarkets", {
      id: "keywordMarkets",
      ...NUMBER_SORT,
      meta: { label: t("apps.columns.keywordMarkets"), numeric: true },
      header: ({ column }) => (
        <SortableHeader
          column={column}
          label={t("apps.columns.keywordMarkets")}
        />
      ),
      cell: ({ getValue }) => countCell(getValue(), context.locale),
    }),
    columnHelper.accessor("createdAt", {
      id: "added",
      sortFn: "text",
      sortDescFirst: true,
      meta: { label: t("apps.columns.added") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("apps.columns.added")} />
      ),
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap">
          {formatDateInLocale(getValue(), context.locale)}
        </span>
      ),
    }),
  ]);
};
