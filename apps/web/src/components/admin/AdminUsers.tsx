"use client";

import { useDeferredValue, useMemo, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { userMatches } from "@/lib/admin-search";
import { adminUsersOptions, authStatusOptions } from "@/lib/queries";
import { adminUserListParsers, adminUserSortParser } from "@/lib/search-params";
import { useAppLocale } from "@/lib/use-app-locale";
import { AdminList } from "./AdminList";
import { useAdminTable } from "./useAdminTable";
import { userColumns } from "./user-columns";
import { workspaceChip } from "./workspace-chip";

export function AdminUsers() {
  const [, startTransition] = useTransition();
  const t = useTranslations("admin");
  const locale = useAppLocale();
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
  const columns = useMemo(
    () => userColumns({ translator: t, locale }),
    [t, locale],
  );

  const table = useAdminTable({
    name: "admin-users",
    data: users.items.filter((user) => userMatches(user, query)),
    columns,
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
      caption={t("users.caption")}
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
        t,
      )}
      onClearFilters={() => void setList({ q: null, workspace: null })}
      reads={t("common.auditRead")}
    />
  );
}
