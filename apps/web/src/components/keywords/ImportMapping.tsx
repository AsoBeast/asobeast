"use client";

import type { Store } from "@asobeast/shared";
import { useTranslations } from "next-intl";
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
import { ALL_APPS, type FileScope } from "@/lib/csv-import/scope";

const FIELD_KEYS: Record<ImportField, string> = {
  keyword: "keyword",
  country: "country",
  tags: "tags",
  note: "note",
};

const NONE = "none";

export function ImportMapping({
  store,
  market,
  onMarketChange,
  view,
  scope,
  options,
  onViewChange,
  disabled,
}: {
  store: Store;
  market: string;
  onMarketChange: (market: string) => void;
  view: FileView;
  scope: FileScope;
  options: ColumnOption[];
  onViewChange: (view: FileView) => void;
  disabled: boolean;
}) {
  const t = useTranslations("keywords");
  const fieldLabel = (field: ImportField) => t(`import.${FIELD_KEYS[field]}`);
  const rowCount = (rows: number) => t("import.rowCount", { count: rows });
  const pick = (field: ImportField, value: string) =>
    onViewChange({
      ...view,
      mapping: {
        ...view.mapping,
        [field]: value === NONE ? null : Number(value),
      },
    });

  return (
    <fieldset
      disabled={disabled}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <legend className="px-1 text-body font-medium">
        {t("import.columns")}
      </legend>
      <div className="flex items-center gap-2">
        <Switch
          id="keyword-import-header"
          checked={view.hasHeader}
          onCheckedChange={(hasHeader) => onViewChange({ ...view, hasHeader })}
        />
        <Label htmlFor="keyword-import-header">
          {t("import.firstRowHeader")}
        </Label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {IMPORT_FIELDS.map((field) => {
          const value = view.mapping[field];
          const id = `keyword-import-column-${field}`;
          return (
            <div key={field} className="flex flex-col gap-1.5">
              <Label htmlFor={id}>{fieldLabel(field)}</Label>
              <Select
                value={value === null ? NONE : String(value)}
                onValueChange={(next) => pick(field, next)}
              >
                <SelectTrigger
                  id={id}
                  aria-label={t("import.columnLabel", {
                    field: fieldLabel(field),
                  })}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {field === "keyword" ? null : (
                    <SelectItem value={NONE}>
                      {t("import.notInFile")}
                    </SelectItem>
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
      {view.hasHeader && scope.apps.length > 1 ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="keyword-import-app">{t("import.appToImport")}</Label>
          <Select
            value={view.app ?? ""}
            onValueChange={(app) => onViewChange({ ...view, app })}
          >
            <SelectTrigger
              id="keyword-import-app"
              aria-label={t("import.appToImport")}
            >
              <SelectValue placeholder={t("import.chooseApp")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_APPS}>
                {t("import.allApps", { rows: rowCount(scope.rows) })}
              </SelectItem>
              {scope.apps.map((app) => (
                <SelectItem key={app.value} value={app.value}>
                  {t("import.appRows", {
                    app: app.label,
                    rows: rowCount(app.rows),
                  })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="keyword-import-market">
          {t("import.fallbackMarket")}
        </Label>
        <CountrySelect
          id="keyword-import-market"
          store={store}
          value={market}
          onChange={onMarketChange}
          ariaLabel={t("import.fallbackMarket")}
        />
      </div>
    </fieldset>
  );
}
