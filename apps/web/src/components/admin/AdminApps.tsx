"use client";

import { useDeferredValue, useMemo, useTransition } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryStates } from "nuqs";
import { useTranslations } from "next-intl";
import { STORES } from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { appMatches } from "@/lib/admin-search";
import { storeLabel } from "@/lib/format";
import { adminAppsOptions, authStatusOptions } from "@/lib/queries";
import { adminAppListParsers, adminAppSortParser } from "@/lib/search-params";
import { countBy, oneOf } from "@/lib/table/facets";
import { useAppLocale } from "@/lib/use-app-locale";
import { AdminList } from "./AdminList";
import { appColumns } from "./app-columns";
import { useAdminTable } from "./useAdminTable";
import { workspaceChip } from "./workspace-chip";

export function AdminApps() {
  const [, startTransition] = useTransition();
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const [{ q, workspace, store, sort, dir }, setList] = useQueryStates(
    adminAppListParsers,
    {
      startTransition,
    },
  );
  const { data: apps } = useSuspenseQuery(
    adminAppsOptions(workspace ?? undefined),
  );
  const { data: status } = useSuspenseQuery(authStatusOptions);
  const query = useDeferredValue(q);
  const searched = apps.items.filter((app) => appMatches(app, query));
  const columns = useMemo(
    () => appColumns({ translator: t, locale }),
    [t, locale],
  );

  const table = useAdminTable({
    name: "admin-apps",
    data: searched.filter(
      (app) => store.length === 0 || oneOf(app.store, store),
    ),
    columns,
    getRowId: (app) => app.id,
    sort: { sort, dir },
    onSort: (next) =>
      void setList({
        sort: next.sort === null ? null : adminAppSortParser.parse(next.sort),
        dir: next.dir,
      }),
    billing: status.billing,
  });

  return (
    <AdminList
      table={table}
      caption={t("apps.caption")}
      noun="app"
      loaded={apps.items.length}
      total={apps.total}
      billing={status.billing}
      search={q}
      onSearch={(next, options) => void setList({ q: next }, options)}
      filters={
        <FacetFilter
          title={t("apps.store")}
          options={STORES.map((store) => ({
            value: store,
            label: storeLabel(store),
          }))}
          selected={store}
          counts={countBy(searched, (app) => app.store)}
          onChange={(next) => void setList({ store: next })}
        />
      }
      chips={[
        ...store.map((value) => ({
          key: `store-${value}`,
          label: t("apps.storeChip", { store: storeLabel(value) }),
          onRemove: () =>
            void setList({ store: store.filter((entry) => entry !== value) }),
        })),
        ...workspaceChip(
          workspace,
          apps.items,
          () => void setList({ workspace: null }),
          t,
        ),
      ]}
      reads={t("common.appsAuditRead")}
      onClearFilters={() =>
        void setList({ q: null, store: null, workspace: null })
      }
    />
  );
}
