import {
  flexRender,
  type RowData,
  type Table,
  type TableFeatures,
} from "@tanstack/react-table";
import { TableCell, TableFooter, TableRow } from "@/components/ui/table";
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
    <TableFooter className="sticky bottom-0 z-20 bg-muted">
      <TableRow aria-rowindex={rowIndex} className="bg-muted hover:bg-muted">
        {group.headers.map((header) => (
          <TableCell
            key={header.id}
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
