"use client";

import { useMemo, useState } from "react";
import { useTable, type RowSelectionState } from "@tanstack/react-table";
import type { KeywordDiscoveryItem, Store } from "@asobeast/shared";
import { keywordTableFeatures } from "../keyword-table-features";
import { discoveryColumns } from "./discovery-columns";
import { DiscoveryRows } from "./DiscoveryRows";

export function DiscoveredTable({
  rows,
  store,
}: {
  rows: KeywordDiscoveryItem[];
  store: Store;
}) {
  const columns = useMemo(() => discoveryColumns(store), [store]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const table = useTable({
    features: keywordTableFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.keywordId,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
  });
  return <DiscoveryRows table={table} />;
}
