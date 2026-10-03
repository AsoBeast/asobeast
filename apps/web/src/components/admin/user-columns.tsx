"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { PLANS, type AdminUser } from "@asobeast/shared";
import { SortableHeader } from "@/components/data-table/SortableHeader";
import type { DataTableFeatures } from "@/components/data-table/table-features";
import { Badge } from "@/components/ui/badge";
import { workspaceListHref } from "@/lib/admin-sections";
import { formatDate } from "@/lib/format";
import { WorkspaceName } from "./cells";

const columnHelper = createColumnHelper<DataTableFeatures, AdminUser>();

function Account({ user }: { user: AdminUser }) {
  return (
    <div className="flex max-w-64 min-w-0 flex-col">
      <span className="flex items-center gap-2">
        <span className="truncate font-medium" translate="no">
          {user.email}
        </span>
        {user.platformOperator ? (
          <Badge variant="secondary">Operator</Badge>
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

function Confirmation({ confirmed }: { confirmed: boolean }) {
  const Icon = confirmed ? CheckCircle2 : CircleDashed;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon
        aria-hidden
        className={
          confirmed ? "size-4 text-success" : "size-4 text-muted-foreground"
        }
      />
      {confirmed ? "Confirmed" : "Not confirmed"}
    </span>
  );
}

export const userColumns = columnHelper.columns([
  columnHelper.accessor("email", {
    id: "email",
    sortFn: "text",
    sortDescFirst: false,
    enableHiding: false,
    header: ({ column }) => <SortableHeader column={column} label="Account" />,
    cell: ({ row }) => <Account user={row.original} />,
  }),
  columnHelper.accessor("role", {
    id: "role",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Role" },
    header: ({ column }) => <SortableHeader column={column} label="Role" />,
    cell: ({ row }) => <span className="capitalize">{row.original.role}</span>,
  }),
  columnHelper.display({
    id: "confirmed",
    meta: { label: "Email", phone: true },
    header: () => "Email",
    cell: ({ row }) => <Confirmation confirmed={row.original.emailVerified} />,
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
        href={workspaceListHref("apps", row.original.workspaceId)}
        title={`Apps in ${row.original.workspaceName}`}
      />
    ),
  }),
  columnHelper.accessor("workspacePlan", {
    id: "plan",
    sortFn: "text",
    sortDescFirst: false,
    meta: { label: "Plan" },
    header: ({ column }) => <SortableHeader column={column} label="Plan" />,
    cell: ({ row }) => PLANS[row.original.workspacePlan].displayName,
  }),
  columnHelper.accessor("createdAt", {
    id: "joined",
    sortFn: "text",
    sortDescFirst: true,
    meta: { label: "Joined" },
    header: ({ column }) => <SortableHeader column={column} label="Joined" />,
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDate(row.original.createdAt)}
      </span>
    ),
  }),
]);
