"use client";

import { useDeferredValue, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { userMatches } from "@/lib/admin-search";
import { adminUsersOptions, authStatusOptions } from "@/lib/queries";
import { adminUserListParsers, adminUserSortParser } from "@/lib/search-params";
import { AdminList } from "./AdminList";
import { useAdminTable } from "./useAdminTable";
import { userColumns } from "./user-columns";
import { workspaceChip } from "./workspace-chip";

export function AdminUsers() {
  const [, startTransition] = useTransition();
  const [{ q, workspace, sort, dir }, setList] = useQueryStates(
    adminUserListParsers,
    {
      startTransition,
    },
  );
  const { data: users } = useSuspenseQuery(
    adminUsersOptions(workspace ?? undefined),
  );
  const { data: status } = useSuspenseQuery(authStatusOptions);
  const query = useDeferredValue(q);

  const table = useAdminTable({
    name: "admin-users",
    data: users.items.filter((user) => userMatches(user, query)),
    columns: userColumns,
    getRowId: (user) => user.id,
    sort: { sort, dir },
    onSort: (next) =>
      void setList({
        sort: next.sort === null ? null : adminUserSortParser.parse(next.sort),
        dir: next.dir,
      }),
    billing: status.billing,
  });

  return (
    <AdminList
      table={table}
      caption="Accounts on this instance"
      noun="account"
      loaded={users.items.length}
      total={users.total}
      billing={status.billing}
      search={q}
      onSearch={(next, options) => void setList({ q: next }, options)}
      chips={workspaceChip(
        workspace,
        users.items,
        () => void setList({ workspace: null }),
      )}
      onClearFilters={() => void setList({ q: null, workspace: null })}
    />
  );
}
