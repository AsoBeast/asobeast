"use client";

import type { ComponentProps } from "react";
import type { SortDirection } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableColumn {
  getIsSorted: () => SortDirection | false;
  getToggleSortingHandler: () => ((event: unknown) => void) | undefined;
}

export function SortableHeader({
  column,
  label,
  className,
  ...props
}: ComponentProps<"button"> & {
  column: SortableColumn;
  label: string;
}) {
  const sorted = column.getIsSorted();
  const Icon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <button
      {...props}
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        "inline-flex items-center gap-1 transition-colors",
        sorted ? "text-foreground" : "hover:text-foreground",
        className,
      )}
    >
      {label}
      <Icon className={cn("size-3.5", !sorted && "opacity-40")} aria-hidden />
    </button>
  );
}
