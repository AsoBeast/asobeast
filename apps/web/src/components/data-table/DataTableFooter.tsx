import {
  flexRender,
  type RowData,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table";
import { TableCell, TableFooter, TableRow } from "@/components/ui/table";
import { isNumericColumn } from "@/lib/table/column-visibility";
import { cn } from "@/lib/utils";

export function DataTableFooter<
  TFeatures extends TableFeatures,
  TData extends RowData,
>({
  table,
  rowIndex,
  cellClassName,
}: {
  table: Table<TFeatures, TData>;
  rowIndex: number;
  cellClassName?: (columnId: string) => string | undefined;
}) {
  const group = table.getFooterGroups().at(-1);
  if (!group?.headers.some((header) => header.column.columnDef.footer)) {
    return null;
  }
  return (
    <TableFooter className="sticky bottom-0 z-20 bg-card">
      <TableRow
        aria-rowindex={rowIndex}
        className="border-b-0 bg-card text-label text-muted-foreground hover:bg-card"
      >
        {group.headers.map((header) => (
          <TableCell
            key={header.id}
            numeric={isNumericColumn(header.column.columnDef.meta)}
            className={cn("align-top", cellClassName?.(header.column.id))}
          >
            {header.isPlaceholder
              ? null
              : flexRender(header.column.columnDef.footer, header.getContext())}
          </TableCell>
        ))}
      </TableRow>
    </TableFooter>
  );
}
