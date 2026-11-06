"use client";

import { useMemo } from "react";
import {
  useTable,
  type OnChangeFn,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { KeywordDiscoveryItem, Store } from "@asobeast/shared";
import { keywordTableFeatures } from "../keyword-table-features";
import { discoveryColumns } from "./discovery-columns";
import { DiscoveryRows } from "./DiscoveryRows";

export function DiscoveredTable({
  rows,
  store,
  rowSelection,
  onRowSelectionChange,
}: {
  rows: KeywordDiscoveryItem[];
  store: Store;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}) {
  const columns = useMemo(() => discoveryColumns(store), [store]);
  const table = useTable({
    features: keywordTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: { rowSelection },
    onRowSelectionChange,
  });
  return <DiscoveryRows table={table} />;
}
