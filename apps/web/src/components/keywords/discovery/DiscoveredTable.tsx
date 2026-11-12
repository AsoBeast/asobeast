"use client";

import { useMemo, type ReactNode } from "react";
import {
  useTable,
  type OnChangeFn,
  type RowSelectionState,
} from "@tanstack/react-table";
import { useQueryStates } from "nuqs";
import type { KeywordDiscoveryItem, Store } from "@asobeast/shared";
import { useUrlSorting } from "@/components/data-table/useUrlSorting";
import { DISCOVERY_URL_KEYS, discoveryTableParsers } from "@/lib/search-params";
import { keywordTableFeatures } from "../keyword-table-features";
import { discoveryColumns } from "./discovery-columns";
import { DiscoveryRows } from "./DiscoveryRows";

export function useDiscoveryTableParams() {
  return useQueryStates(discoveryTableParsers, {
    urlKeys: DISCOVERY_URL_KEYS,
  });
}

export function DiscoveredTable({
  rows,
  store,
  rowSelection,
  onRowSelectionChange,
  footer,
  onClearSearch,
}: {
  rows: KeywordDiscoveryItem[];
  store: Store;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  footer: ReactNode;
  onClearSearch: () => void;
}) {
  const columns = useMemo(() => discoveryColumns(store), [store]);
  const [{ sort, dir, q }, setParams] = useDiscoveryTableParams();
  const { sorting, onSortingChange } = useUrlSorting(
    { sort, dir },
    columns,
    (next) =>
      void setParams({
        sort:
          next.sort === null
            ? null
            : discoveryTableParsers.sort.parse(next.sort),
        dir: next.dir,
      }),
  );
  const table = useTable({
    features: keywordTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: { rowSelection, sorting, globalFilter: q },
    onRowSelectionChange,
    onSortingChange,
    globalFilterFn: "includesString",
    getColumnCanGlobalFilter: (column) => column.id === "keyword",
  });
  return (
    <DiscoveryRows
      table={table}
      footer={footer}
      onClearSearch={onClearSearch}
    />
  );
}
