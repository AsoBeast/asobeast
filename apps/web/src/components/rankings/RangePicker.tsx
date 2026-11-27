"use client";

import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { useTranslations } from "next-intl";
import { rangeLabel, type DayPreset } from "@/lib/ranges";

export function PrintRangeLabel({ preset }: { preset: DayPreset }) {
  const t = useTranslations("format");
  return (
    <span
      data-slot="print-range"
      className="hidden text-body text-muted-foreground print:inline"
    >
      {rangeLabel(preset, t)}
    </span>
  );
}

export function RangePicker<T extends DayPreset>({
  presets,
  value,
  onChange,
  label,
}: {
  presets: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label?: string;
}) {
  const t = useTranslations("rankings");
  const format = useTranslations("format");
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsList aria-label={label ?? t("dateRange")} className="print:hidden">
        {presets.map((preset) => (
          <TabsOption key={preset} value={preset}>
            {rangeLabel(preset, format)}
          </TabsOption>
        ))}
      </TabsList>
      <PrintRangeLabel preset={value} />
    </Tabs>
  );
}
