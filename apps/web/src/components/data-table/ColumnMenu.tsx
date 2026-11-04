"use client";

import { Fragment, type ReactNode } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TableColumnMeta } from "@/lib/table/column-visibility";

interface HideableColumn {
  id: string;
  columnDef: { meta?: TableColumnMeta };
  getCanHide: () => boolean;
  getIsVisible: () => boolean;
  toggleVisibility: (value?: boolean) => void;
}

export interface ViewOption {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  description?: ReactNode;
}

export function ColumnMenu({
  columns,
  options = [],
}: {
  columns: readonly HideableColumn[];
  options?: readonly ViewOption[];
}) {
  const hideable = columns.filter((column) => column.getCanHide());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 aria-hidden />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {hideable.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(value) => column.toggleVisibility(value)}
            onSelect={(event) => event.preventDefault()}
          >
            {column.columnDef.meta?.label ?? column.id}
          </DropdownMenuCheckboxItem>
        ))}
        {options.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Show in the table</DropdownMenuLabel>
            {options.map((option) => (
              <Fragment key={option.id}>
                <DropdownMenuCheckboxItem
                  checked={option.checked}
                  onCheckedChange={option.onCheckedChange}
                  onSelect={(event) => event.preventDefault()}
                >
                  {option.label}
                </DropdownMenuCheckboxItem>
                {option.description ? (
                  <div className="px-2 pb-1.5 text-caption text-muted-foreground">
                    {option.description}
                  </div>
                ) : null}
              </Fragment>
            ))}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
