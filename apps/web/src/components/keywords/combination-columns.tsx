"use client";

import { createColumnHelper } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type {
  CombinationField,
  CombinationStatus,
  KeywordCombination,
} from "@/lib/keyword-combinations";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { oneOf } from "@/lib/table/facets";
import type { KeywordTableFeatures } from "./keyword-table-features";

export const COMBINATION_STATUS_LABELS: Record<CombinationStatus, string> = {
  tracked: "Tracked",
  paused: "Paused",
  untracked: "Not tracked",
};

const STATUS_VARIANT: Record<
  CombinationStatus,
  "success" | "secondary" | "outline"
> = {
  tracked: "success",
  paused: "secondary",
  untracked: "outline",
};

export const HIDDEN_COMBINATION_COLUMNS = { words: false };

export function wordCountLabel(count: number): string {
  return count === 1 ? "1 word" : `${count} words`;
}

function fieldLabels(fields: readonly CombinationField[]): string {
  return fields.map((field) => METADATA_FIELD_LABELS[field]).join(", ");
}

function StatusCell({ combination }: { combination: KeywordCombination }) {
  const { phrase, status, trackedAs } = combination;
  return (
    <span className="flex items-center gap-2">
      <Badge variant={STATUS_VARIANT[status]}>
        {COMBINATION_STATUS_LABELS[status]}
      </Badge>
      {trackedAs !== null && trackedAs !== phrase ? (
        <span className="text-caption text-muted-foreground">
          as {trackedAs}
        </span>
      ) : null}
    </span>
  );
}

const columnHelper = createColumnHelper<
  KeywordTableFeatures,
  KeywordCombination
>();

export const COMBINATION_COLUMNS = columnHelper.columns([
  columnHelper.display({
    id: "select",
    enableHiding: false,
    header: () => <span className="sr-only">Select</span>,
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label={
          row.getCanSelect()
            ? `Select ${row.original.phrase}`
            : `${row.original.phrase}: already tracked`
        }
      />
    ),
  }),
  columnHelper.accessor("phrase", {
    id: "phrase",
    header: "Phrase",
    cell: ({ row }) => row.original.phrase,
  }),
  columnHelper.display({
    id: "fields",
    header: "Found in",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {fieldLabels(row.original.fields)}
      </span>
    ),
  }),
  columnHelper.accessor("status", {
    id: "status",
    header: "Status",
    filterFn: (row, id, selected: CombinationStatus[]) =>
      oneOf(row.getValue<CombinationStatus>(id), selected),
    cell: ({ row }) => <StatusCell combination={row.original} />,
  }),
  columnHelper.accessor((row) => String(row.wordCount), {
    id: "words",
    enableHiding: false,
    filterFn: (row, id, selected: string[]) =>
      oneOf(row.getValue<string>(id), selected),
  }),
]);
