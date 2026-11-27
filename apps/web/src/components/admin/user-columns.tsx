"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle2, CircleDashed } from "lucide-react";
import type { AdminUser } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import type { TranslationContext } from "@/i18n/translator";
import { workspaceListHref } from "@/lib/admin-sections";
import { heldPlanLabel, stageLabel } from "@/lib/admin-stages";
import { formatDateInLocale } from "@/lib/format";
import { WorkspaceName } from "./cells";

const columnHelper = createColumnHelper<DataTableFeatures, AdminUser>();

function roleLabel(role: string, context: TranslationContext): string {
  return role === "owner" || role === "member"
    ? context.translator(`common.roles.${role}`)
    : role;
}

function Account({
  user,
  context,
}: {
  user: AdminUser;
  context: TranslationContext;
}) {
  return (
    <div className="flex max-w-64 min-w-0 flex-col">
      <span className="flex items-center gap-2">
        <span className="truncate font-medium" translate="no">
          {user.email}
        </span>
        {user.platformOperator ? (
          <Badge variant="secondary">
            {context.translator("common.operator")}
          </Badge>
        ) : null}
      </span>
      {user.name ? (
        <span className="truncate text-caption text-muted-foreground">
          {user.name}
        </span>
      ) : null}
    </div>
  );
}

function Confirmation({
  confirmed,
  context,
}: {
  confirmed: boolean;
  context: TranslationContext;
}) {
  const Icon = confirmed ? CheckCircle2 : CircleDashed;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon
        aria-hidden
        className={
          confirmed ? "size-4 text-success" : "size-4 text-muted-foreground"
        }
      />
      <span className="max-sm:sr-only">
        {context.translator(
          confirmed ? "common.confirmed" : "common.notConfirmed",
        )}
      </span>
    </span>
  );
}

function UserStage({
  user,
  context,
}: {
  user: AdminUser;
  context: TranslationContext;
}) {
  const held = user.workspaceStage
    ? heldPlanLabel(user.workspacePlan, context.translator)
    : null;
  return (
    <div className="flex flex-col">
      <span>
        {stageLabel(
          user.workspaceStage,
          user.workspacePlan,
          context.translator,
        )}
      </span>
      {held ? (
        <span className="text-caption text-muted-foreground">{held}</span>
      ) : null}
    </div>
  );
}

export const userColumns = (context: TranslationContext) => {
  const t = context.translator;
  return columnHelper.columns([
    columnHelper.accessor("email", {
      id: "email",
      sortFn: "text",
      sortDescFirst: false,
      enableHiding: false,
      header: ({ column }) => (
        <SortableHeader column={column} label={t("users.columns.account")} />
      ),
      cell: ({ row }) => <Account user={row.original} context={context} />,
    }),
    columnHelper.accessor((user) => roleLabel(user.role, context), {
      id: "role",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: t("users.columns.role") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("users.columns.role")} />
      ),
      cell: ({ getValue }) => <span>{getValue()}</span>,
    }),
    columnHelper.display({
      id: "confirmed",
      meta: { label: t("users.columns.email"), phone: true },
      header: () => t("users.columns.email"),
      cell: ({ row }) => (
        <Confirmation
          confirmed={row.original.emailVerified}
          context={context}
        />
      ),
    }),
    columnHelper.accessor("workspaceName", {
      id: "workspace",
      sortFn: "text",
      sortDescFirst: false,
      meta: { label: t("users.columns.workspace") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("users.columns.workspace")} />
      ),
      cell: ({ row }) => (
        <WorkspaceName
          name={row.original.workspaceName}
          workspaceId={row.original.workspaceId}
          href={workspaceListHref("apps", row.original.workspaceId)}
          title={t("users.appsTitle", {
            name: row.original.workspaceName,
          })}
        />
      ),
    }),
    columnHelper.accessor(
      (user) => stageLabel(user.workspaceStage, user.workspacePlan, t),
      {
        id: "plan",
        sortFn: "text",
        sortDescFirst: false,
        meta: { label: t("users.columns.stage") },
        header: ({ column }) => (
          <SortableHeader column={column} label={t("users.columns.stage")} />
        ),
        cell: ({ row }) => <UserStage user={row.original} context={context} />,
      },
    ),
    columnHelper.accessor("createdAt", {
      id: "joined",
      sortFn: "text",
      sortDescFirst: true,
      meta: { label: t("users.columns.joined") },
      header: ({ column }) => (
        <SortableHeader column={column} label={t("users.columns.joined")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDateInLocale(row.original.createdAt, context.locale)}
        </span>
      ),
    }),
  ]);
};
