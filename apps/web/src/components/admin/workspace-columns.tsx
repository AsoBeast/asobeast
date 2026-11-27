"use client";

import { useContext } from "react";
import Link from "next/link";
import { createColumnHelper } from "@tanstack/react-table";
import type { SupportWorkspaceSummary } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import type { TranslationContext } from "@/i18n/translator";
import { workspaceListHref } from "@/lib/admin-sections";
import {
  stageLabel,
  stageWithPlanLabel,
  workspaceStageLabel,
} from "@/lib/admin-stages";
import { formatDateInLocale, formatNumberInLocale } from "@/lib/format";
import { NUMBER_SORT, WorkspaceName } from "./cells";
import { WorkspaceSheetContext } from "./workspace-sheet/workspace-sheet-context";

const columnHelper = createColumnHelper<
  DataTableFeatures,
  SupportWorkspaceSummary
>();

function StatePills({
  workspace,
  context,
}: {
  workspace: SupportWorkspaceSummary;
  context: TranslationContext;
}) {
  const t = context.translator;
  const date = (value: string) => formatDateInLocale(value, context.locale);
  const renews =
    workspace.stage === "trialing" ||
    workspace.stage === "paying" ||
    workspace.stage === "payment-failed";
  return (
    <span className="flex flex-wrap gap-1">
      {workspace.stage === "payment-failed" ? (
        <Badge variant="destructive">
          {workspaceStageLabel("payment-failed", t)}
        </Badge>
      ) : null}
      {workspace.stage === "trialing" && workspace.trialEndsAt ? (
        <Badge variant="flat">
          {t("workspaces.pills.trialUntil", {
            date: date(workspace.trialEndsAt),
          })}
        </Badge>
      ) : null}
      {renews && workspace.cancelAtPeriodEnd && workspace.planExpiresAt ? (
        <Badge variant="warning">
          {t("workspaces.pills.canceling", {
            date: date(workspace.planExpiresAt),
          })}
        </Badge>
      ) : null}
      {workspace.suspendedAt ? (
        <Badge
          variant="destructive"
          title={workspace.suspendedReason ?? undefined}
        >
          {t("workspaces.pills.suspended")}
        </Badge>
      ) : null}
      {workspace.deletionDueAt ? (
        <Badge
          variant="destructive"
          title={
            workspace.deletionRequestedBy && workspace.deletionRequestedAt
              ? t("workspaces.pills.requestedByOn", {
                  by: workspace.deletionRequestedBy,
                  date: date(workspace.deletionRequestedAt),
                })
              : undefined
          }
        >
          {t("workspaces.pills.deletes", {
            date: date(workspace.deletionDueAt),
          })}
        </Badge>
      ) : null}
    </span>
  );
}

function WorkspaceStanding({
  workspace,
  context,
}: {
  workspace: SupportWorkspaceSummary;
  context: TranslationContext;
}) {
  const t = context.translator;
  const stage = workspace.stage;
  const named = stage !== "self-hosted" && stage !== "payment-failed";
  return (
    <div className="flex max-w-64 flex-col items-start gap-1">
      {named ? (
        <span>{stageWithPlanLabel(stage, workspace.plan, t)}</span>
      ) : null}
      <StatePills workspace={workspace} context={context} />
      {workspace.suspendedReason ? (
        <span className="text-caption wrap-anywhere text-muted-foreground">
          {workspace.suspendedReason}
        </span>
      ) : null}
      {workspace.deletionRequestedBy ? (
        <span className="text-caption wrap-anywhere text-muted-foreground">
          {t("workspaces.pills.askedBy", {
            by: workspace.deletionRequestedBy,
          })}
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

export const workspaceColumns = (context: TranslationContext) => {
  const t = context.translator;
  return columnHelper.columns([
    columnHelper.accessor("name", {
      id: "name",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader
          column={column}
          label={t("workspaces.columns.workspace")}
        />
      ),
      cell: ({ row }) => <WorkspaceNameCell workspace={row.original} />,
    }),
    columnHelper.accessor(
      (workspace) => stageLabel(workspace.stage, workspace.plan, t),
      {
        id: "plan",
        sortFn: "text",
        sortDescFirst: false,
        meta: { label: t("workspaces.columns.stage"), phone: true },
        header: ({ column }) => (
          <SortableHeader
            column={column}
            label={t("workspaces.columns.stage")}
          />
        ),
        cell: ({ row }) => (
          <WorkspaceStanding workspace={row.original} context={context} />
        ),
      },
    ),
    columnHelper.accessor("members", {
      id: "members",
      ...NUMBER_SORT,
      meta: { label: t("workspaces.columns.members"), numeric: true },
      header: ({ column }) => (
        <SortableHeader
          column={column}
          label={t("workspaces.columns.members")}
        />
      ),
      cell: ({ row }) => (
        <Link
          href={workspaceListHref("users", row.original.workspaceId)}
          aria-label={t("workspaces.memberLink", {
            count: row.original.members,
            name: row.original.name,
          })}
          className="numeric link-underline"
        >
          {formatNumberInLocale(row.original.members, context.locale)}
        </Link>
      ),
    }),
    columnHelper.accessor("apps", {
      id: "apps",
      ...NUMBER_SORT,
      meta: { label: t("workspaces.columns.apps"), numeric: true },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("workspaces.columns.apps")} />
      ),
      cell: ({ row }) => (
        <div className="flex flex-col">
          <Link
            href={workspaceListHref("apps", row.original.workspaceId)}
            aria-label={t("workspaces.appLink", {
              count: row.original.apps,
              name: row.original.name,
            })}
            className="numeric link-underline"
          >
            {formatNumberInLocale(row.original.apps, context.locale)}
          </Link>
          <span className="text-caption whitespace-nowrap text-muted-foreground">
            {t("common.competitorCount", { count: row.original.competitors })}
          </span>
        </div>
      ),
    }),
    columnHelper.accessor("keywordMarkets", {
      id: "keywordMarkets",
      ...NUMBER_SORT,
      meta: { label: t("workspaces.columns.keywordMarkets"), numeric: true },
      header: ({ column }) => (
        <SortableHeader
          column={column}
          label={t("workspaces.columns.keywordMarkets")}
        />
      ),
      cell: ({ row }) => (
        <span className="numeric">
          {formatNumberInLocale(row.original.keywordMarkets, context.locale)}
        </span>
      ),
    }),
    columnHelper.accessor("createdAt", {
      id: "created",
      sortFn: "text",
      sortDescFirst: true,
      meta: { label: t("workspaces.columns.created") },
      header: ({ column }) => (
        <SortableHeader
          column={column}
          label={t("workspaces.columns.created")}
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateInLocale(row.original.createdAt, context.locale)}
        </span>
      ),
    }),
  ]);
};
