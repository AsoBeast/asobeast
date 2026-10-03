"use client";

import { useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { workspaceMatches } from "@/lib/admin-search";
import { adminOverviewOptions, adminWorkspacesOptions } from "@/lib/queries";
import {
  adminWorkspaceListParsers,
  adminWorkspaceSortParser,
} from "@/lib/search-params";
import { AdminList } from "./AdminList";
import { useAdminTable } from "./useAdminTable";
import { workspaceColumns } from "./workspace-columns";

export function AdminWorkspaces() {
  const { data: workspaces } = useSuspenseQuery(adminWorkspacesOptions);
  const { data: overview } = useSuspenseQuery(adminOverviewOptions);
  const [{ q, sort, dir }, setList] = useQueryStates(adminWorkspaceListParsers);
  const query = useDeferredValue(q);

  const table = useAdminTable({
    name: "admin-workspaces",
    data: workspaces.filter((workspace) => workspaceMatches(workspace, query)),
    columns: workspaceColumns,
    getRowId: (workspace) => workspace.workspaceId,
    sort: { sort, dir },
    onSort: (next) =>
      void setList({
        sort:
          next.sort === null ? null : adminWorkspaceSortParser.parse(next.sort),
        dir: next.dir,
      }),
    billing: overview.billing,
  });

  return (
    <AdminList
      table={table}
      caption="Workspaces on this instance"
      noun="workspace"
      loaded={workspaces.length}
      total={workspaces.length}
      billing={overview.billing}
      search={q}
      onSearch={(next, options) => void setList({ q: next }, options)}
      onClearFilters={() => void setList({ q: null })}
    />
  );
}
