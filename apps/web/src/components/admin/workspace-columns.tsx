"use client";

import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import { PLANS, type SupportWorkspaceSummary } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { workspaceListHref } from "@/lib/admin-sections";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { NUMBER_SORT, WorkspaceName } from "./cells";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  SupportWorkspaceSummary
>();

const subscriptionOf = (workspace: SupportWorkspaceSummary) =>
  workspace.subscriptionStatus ??
  (workspace.hasSubscription ? "subscribed" : null);

function WorkspaceStatus({
  workspace,
}: {
  workspace: SupportWorkspaceSummary;
}) {
  if (workspace.suspendedAt) {
    return (
      <div className="flex max-w-56 flex-col items-start gap-1">
        <Badge variant="destructive">Suspended</Badge>
        {workspace.suspendedReason ? (
          <span className="text-caption text-muted-foreground">
            {workspace.suspendedReason}
          </span>
        ) : null}
      </div>
    );
  }
  if (workspace.plan === "trial" && workspace.trialEndsAt) {
    return (
      <span className="text-sm whitespace-nowrap">
        Trial until {formatDate(workspace.trialEndsAt)}
      </span>
    );
  }
  return null;
}

export const workspaceColumns = columnHelper.columns([
  columnHelper.accessor("name", {
    id: "name",
    sortFn: "text",
    sortDescFirst: false,
    enableHiding: false,
    header: ({ column }) => (
      <SortableHeader column={column} label="Workspace" />
    ),
    cell: ({ row }) => (
      <WorkspaceName
        name={row.original.name}
        workspaceId={row.original.workspaceId}
      />
    ),
  }),
  columnHelper.accessor("plan", {
    id: "plan",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Plan", phone: true },
    header: ({ column }) => <SortableHeader column={column} label="Plan" />,
    cell: ({ row }) => {
      const subscription = subscriptionOf(row.original);
      return (
        <div className="flex flex-col">
          <span>{PLANS[row.original.plan].displayName}</span>
          {subscription ? (
            <span className="text-caption text-muted-foreground capitalize">
              {subscription}
            </span>
          ) : null}
        </div>
      );
    },
  }),
  columnHelper.accessor("members", {
    id: "members",
    ...NUMBER_SORT,
    meta: { label: "Members" },
    header: ({ column }) => <SortableHeader column={column} label="Members" />,
    cell: ({ row }) => (
      <Link
        href={workspaceListHref("users", row.original.workspaceId)}
        aria-label={`${pluralize(row.original.members, "member")} in ${row.original.name}`}
        className="numeric font-mono underline-offset-4 hover:underline"
      >
        {formatNumber(row.original.members)}
      </Link>
    ),
  }),
  columnHelper.accessor("apps", {
    id: "apps",
    ...NUMBER_SORT,
    meta: { label: "Apps" },
    header: ({ column }) => <SortableHeader column={column} label="Apps" />,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <Link
          href={workspaceListHref("apps", row.original.workspaceId)}
          aria-label={`${pluralize(row.original.apps, "app")} in ${row.original.name}`}
          className="numeric font-mono underline-offset-4 hover:underline"
        >
          {formatNumber(row.original.apps)}
        </Link>
        <span className="text-caption whitespace-nowrap text-muted-foreground">
          {pluralize(row.original.competitors, "competitor")}
        </span>
      </div>
    ),
  }),
  columnHelper.accessor("keywordMarkets", {
    id: "keywordMarkets",
    ...NUMBER_SORT,
    meta: { label: "Keyword markets" },
    header: ({ column }) => (
      <SortableHeader column={column} label="Keyword markets" />
    ),
    cell: ({ row }) => (
      <span className="numeric font-mono">
        {formatNumber(row.original.keywordMarkets)}
      </span>
    ),
  }),
  columnHelper.accessor("createdAt", {
    id: "created",
    sortFn: "text",
    sortDescFirst: true,
    meta: { label: "Created" },
    header: ({ column }) => <SortableHeader column={column} label="Created" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  }),
  columnHelper.display({
    id: "status",
    meta: { label: "Status", phone: true },
    header: () => "Status",
    cell: ({ row }) => <WorkspaceStatus workspace={row.original} />,
  }),
]);
