"use client";

import { createColumnHelper } from "@tanstack/react-table";
import type { AdminApp } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { workspaceListHref } from "@/lib/admin-sections";
import {
  formatCountry,
  formatDate,
  formatNumber,
  storeLabel,
} from "@/lib/format";
import { NUMBER_SORT, WorkspaceName } from "./cells";

const columnHelper = createColumnHelper<DataTableFeatures, AdminApp>();

function AppName({ app }: { app: AdminApp }) {
  return (
    <div className="flex max-w-64 min-w-0 items-center gap-3">
      <AppIcon src={app.iconUrl} name={app.name} size={32} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-medium">
          {app.name ?? "Untitled app"}
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

const countCell = (value: number) => (
  <span className="numeric font-mono">{formatNumber(value)}</span>
);

export const appColumns = columnHelper.columns([
  columnHelper.accessor((app) => app.name ?? "", {
    id: "name",
    sortFn: "text",
    sortDescFirst: false,
    enableHiding: false,
    header: ({ column }) => <SortableHeader column={column} label="App" />,
    cell: ({ row }) => <AppName app={row.original} />,
  }),
  columnHelper.accessor((app) => storeLabel(app.store), {
    id: "store",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Store", phone: true },
    header: ({ column }) => <SortableHeader column={column} label="Store" />,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap">{getValue()}</span>
    ),
  }),
  columnHelper.accessor((app) => formatCountry(app.country), {
    id: "market",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Home market" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Home market" />
    ),
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap">{getValue()}</span>
    ),
  }),
  columnHelper.accessor("workspaceName", {
    id: "workspace",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Workspace" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Workspace" />
    ),
    cell: ({ row }) => (
      <WorkspaceName
        name={row.original.workspaceName}
        workspaceId={row.original.workspaceId}
        href={workspaceListHref("users", row.original.workspaceId)}
        title={`Accounts in ${row.original.workspaceName}`}
      />
    ),
  }),
  columnHelper.accessor("competitors", {
    id: "competitors",
    ...NUMBER_SORT,
    meta: { label: "Competitors" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Competitors" />
    ),
    cell: ({ getValue }) => countCell(getValue()),
  }),
  columnHelper.accessor("keywordMarkets", {
    id: "keywordMarkets",
    ...NUMBER_SORT,
    meta: { label: "Keyword markets" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Keyword markets" />
    ),
    cell: ({ getValue }) => countCell(getValue()),
  }),
  columnHelper.accessor("createdAt", {
    id: "added",
    sortFn: "text",
    sortDescFirst: true,
    meta: { label: "Added" },
    header: ({ column }) => <SortableHeader column={column} label="Added" />,
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap">{formatDate(getValue())}</span>
    ),
  }),
]);
