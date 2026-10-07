"use client";

import type { Store } from "@asobeast/shared";
import { CountrySelect } from "@/components/CountrySelect";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { IMPORT_FIELDS, type ImportField } from "@/lib/csv-import/columns";
import type {
  ColumnOption,
  FileView,
} from "@/lib/csv-import/parse-keyword-file";

const FIELD_LABELS: Record<ImportField, string> = {
  keyword: "Keyword",
  country: "Country",
  tags: "Tags",
  note: "Note",
};

const NONE = "none";

export function ImportMapping({
  store,
  market,
  onMarketChange,
  view,
  options,
  onViewChange,
}: {
  store: Store;
  market: string;
  onMarketChange: (market: string) => void;
  view: FileView;
  options: ColumnOption[];
  onViewChange: (view: FileView) => void;
}) {
  const pick = (field: ImportField, value: string) =>
    onViewChange({
      ...view,
      mapping: {
        ...view.mapping,
        [field]: value === NONE ? null : Number(value),
      },
    });

  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-medium">Columns</legend>
      <div className="flex items-center gap-2">
        <Switch
          id="keyword-import-header"
          checked={view.hasHeader}
          onCheckedChange={(hasHeader) => onViewChange({ ...view, hasHeader })}
        />
        <Label htmlFor="keyword-import-header">First row is a header</Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => {
          const value = view.mapping[field];
          return (
            <div key={field} className="flex flex-col gap-1.5">
              <Label>{FIELD_LABELS[field]}</Label>
              <Select
                value={value === null ? NONE : String(value)}
                onValueChange={(next) => pick(field, next)}
              >
                <SelectTrigger aria-label={`${FIELD_LABELS[field]} column`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field === "keyword" ? null : (
                    <SelectItem value={NONE}>Not in the file</SelectItem>
                  )}
                  {options.map((option) => (
                    <SelectItem key={option.index} value={String(option.index)}>
                      {option.label}
                      {option.sample ? ` (${option.sample})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyword-import-market">
          Market for rows without a country
        </Label>
        <CountrySelect
          id="keyword-import-market"
          store={store}
          value={market}
          onChange={onMarketChange}
          ariaLabel="Market for rows without a country"
        />
      </div>
    </fieldset>
  );
}
