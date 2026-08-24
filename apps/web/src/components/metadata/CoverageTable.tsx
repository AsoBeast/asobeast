import { Check, Minus } from "lucide-react";
import type { KeywordCoverageRow, MetadataField } from "@asobeast/shared";
import { BucketBadge } from "@/components/BucketBadge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { cn } from "@/lib/utils";

const FIELD_ORDER: MetadataField[] = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
];

function CoverageMark({
  covered,
  field,
}: {
  covered: boolean;
  field: MetadataField;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-full",
        covered
          ? "bg-success-subtle text-success"
          : "bg-muted text-muted-foreground",
      )}
    >
      {covered ? (
        <Check className="size-3.5" />
      ) : (
        <Minus className="size-3.5" />
      )}
      <span className="sr-only">
        {covered ? "in" : "missing from"} {METADATA_FIELD_LABELS[field]}
      </span>
    </span>
  );
}

export function CoverageTable({ rows }: { rows: KeywordCoverageRow[] }) {
  const present = new Set(
    rows.flatMap((row) => row.fields.map((field) => field.field)),
  );
  const columns = FIELD_ORDER.filter((field) => present.has(field));

  return (
    <Table containerClassName="rounded-xl border bg-card">
      <TableCaption className="sr-only">
        Keyword coverage across{" "}
        {columns.map((column) => METADATA_FIELD_LABELS[column]).join(", ")},
        with uncovered keywords highlighted.
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Keyword</TableHead>
          <TableHead>Bucket</TableHead>
          {columns.map((column) => (
            <TableHead key={column} className="text-center">
              {METADATA_FIELD_LABELS[column]}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const covered = new Map(
            row.fields.map((field) => [field.field, field.covered]),
          );
          return (
            <TableRow
              key={row.keywordId}
              className={row.uncovered ? "bg-warning-subtle" : undefined}
            >
              <TableCell className="font-medium text-foreground">
                <span className="flex items-center gap-2">
                  {row.text}
                  {row.uncovered ? (
                    <Badge variant="warning">Uncovered</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell>
                <BucketBadge bucket={row.bucket} />
              </TableCell>
              {columns.map((column) => (
                <TableCell key={column} className="text-center">
                  <CoverageMark
                    covered={covered.get(column) ?? false}
                    field={column}
                  />
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
