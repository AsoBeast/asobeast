"use client";

import { useContext } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import type { SupportWorkspaceSummary } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { workspaceListHref } from "@/lib/admin-sections";
import { heldPlanLabel, stageLabel } from "@/lib/admin-stages";
import { formatDate, formatNumber, pluralize } from "@/lib/format";
import { NUMBER_SORT, WorkspaceName } from "./cells";
import { WorkspaceSheetContext } from "./workspace-sheet/workspace-sheet-context";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  SupportWorkspaceSummary
>();

function StatePills({ workspace }: { workspace: SupportWorkspaceSummary }) {
  const renews =
    workspace.stage === "trialing" ||
    workspace.stage === "paying" ||
    workspace.stage === "payment-failed";
  return (
    <span className="flex flex-wrap gap-1">
      {workspace.stage === "payment-failed" ? (
        <Badge variant="destructive">Payment failed</Badge>
      ) : null}
      {workspace.stage === "trialing" && workspace.trialEndsAt ? (
        <Badge variant="flat">{`Trial until ${formatDate(workspace.trialEndsAt)}`}</Badge>
      ) : null}
      {renews && workspace.cancelAtPeriodEnd && workspace.planExpiresAt ? (
        <Badge variant="warning">{`Canceling ${formatDate(workspace.planExpiresAt)}`}</Badge>
      ) : null}
      {workspace.suspendedAt ? (
        <Badge
          variant="destructive"
          title={workspace.suspendedReason ?? undefined}
        >
          Suspended
        </Badge>
      ) : null}
      {workspace.deletionDueAt ? (
        <Badge
          variant="destructive"
          title={
            workspace.deletionRequestedBy && workspace.deletionRequestedAt
              ? `Requested by ${workspace.deletionRequestedBy} on ${formatDate(workspace.deletionRequestedAt)}`
              : undefined
          }
        >
          {`Deletes ${formatDate(workspace.deletionDueAt)}`}
        </Badge>
      ) : null}
    </span>
  );
}

function WorkspaceStanding({
  workspace,
}: {
  workspace: SupportWorkspaceSummary;
}) {
  const stage = workspace.stage;
  const named = stage !== "self-hosted" && stage !== "payment-failed";
  const held = stage ? heldPlanLabel(workspace.plan) : null;
  return (
    <div className="flex max-w-64 flex-col items-start gap-1">
      {named ? (
        <span>
          {held
            ? `${stageLabel(stage, workspace.plan)} · ${held}`
            : stageLabel(stage, workspace.plan)}
        </span>
      ) : null}
      <StatePills workspace={workspace} />
      {workspace.suspendedReason ? (
        <span className="text-caption wrap-anywhere text-muted-foreground">
          {workspace.suspendedReason}
        </span>
      ) : null}
      {workspace.deletionRequestedBy ? (
        <span className="text-caption wrap-anywhere text-muted-foreground">
          {`Asked by ${workspace.deletionRequestedBy}`}
        </span>
      ) : null}
    </div>
  );
}

function WorkspaceNameCell({
  workspace,
}: {
  workspace: SupportWorkspaceSummary;
}) {
  const openSheet = useContext(WorkspaceSheetContext);
  return openSheet ? (
    <WorkspaceName
      name={workspace.name}
      workspaceId={workspace.workspaceId}
      onOpen={() => openSheet(workspace.workspaceId)}
    />
  ) : (
    <WorkspaceName name={workspace.name} workspaceId={workspace.workspaceId} />
  );
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
    cell: ({ row }) => <WorkspaceNameCell workspace={row.original} />,
  }),
  columnHelper.accessor(
    (workspace) => stageLabel(workspace.stage, workspace.plan),
    {
      id: "plan",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: "Stage", phone: true },
      header: ({ column }) => <SortableHeader column={column} label="Stage" />,
      cell: ({ row }) => <WorkspaceStanding workspace={row.original} />,
    },
  ),
  columnHelper.accessor("members", {
    id: "members",
    ...NUMBER_SORT,
    meta: { label: "Members", numeric: true },
    header: ({ column }) => <SortableHeader column={column} label="Members" />,
    cell: ({ row }) => (
      <Link
        href={workspaceListHref("users", row.original.workspaceId)}
        aria-label={`${pluralize(row.original.members, "member")} in ${row.original.name}`}
        className="numeric link-underline"
      >
        {formatNumber(row.original.members)}
      </Link>
    ),
  }),
  columnHelper.accessor("apps", {
    id: "apps",
    ...NUMBER_SORT,
    meta: { label: "Apps", numeric: true },
    header: ({ column }) => <SortableHeader column={column} label="Apps" />,
    cell: ({ row }) => (
      <div className="flex flex-col">
        <Link
          href={workspaceListHref("apps", row.original.workspaceId)}
          aria-label={`${pluralize(row.original.apps, "app")} in ${row.original.name}`}
          className="numeric link-underline"
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
    meta: { label: "Keyword markets", numeric: true },
    header: ({ column }) => (
      <SortableHeader column={column} label="Keyword markets" />
    ),
    cell: ({ row }) => (
      <span className="numeric">
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
]);
