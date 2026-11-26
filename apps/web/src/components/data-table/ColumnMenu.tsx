"use client";

import { Fragment, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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

export interface ViewChoice {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}

export function ColumnMenu({
  columns,
  options = [],
  choices = [],
}: {
  columns: readonly HideableColumn[];
  options?: readonly ViewOption[];
  choices?: readonly ViewChoice[];
}) {
  const hideable = columns.filter((column) => column.getCanHide());
  const t = useTranslations("ui");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button data-action="columns" variant="outline" size="sm">
          <Columns3 aria-hidden />
          {t("columns")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>{t("showColumns")}</DropdownMenuLabel>
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
            <DropdownMenuLabel>{t("showInTable")}</DropdownMenuLabel>
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
        {choices.map((choice) => (
          <Fragment key={choice.id}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{choice.label}</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={choice.value}
              onValueChange={choice.onValueChange}
            >
              {choice.options.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
