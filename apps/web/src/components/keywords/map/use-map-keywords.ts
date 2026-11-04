"use client";

import { useMemo } from "react";
import type { Table } from "@tanstack/react-table";
import type { TrackedKeywordItem } from "@asobeast/shared";
import type { KeywordTableFeatures } from "../keyword-table-features";

export function useKeywordsAcrossZones(
  table: Table<KeywordTableFeatures, TrackedKeywordItem>,
  enabled: boolean,
): TrackedKeywordItem[] {
  const rows = enabled
    ? table.getColumn("zone")?.getFacetedRowModel().rows
    : undefined;
  return useMemo(() => rows?.map((row) => row.original) ?? [], [rows]);
}
