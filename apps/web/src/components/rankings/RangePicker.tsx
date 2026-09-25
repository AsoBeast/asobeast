"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { rangeLabel, type DayPreset } from "@/lib/ranges";

export function PrintRangeLabel({ preset }: { preset: DayPreset }) {
  return (
    <span className="hidden text-body text-muted-foreground print:inline">
      {rangeLabel(preset)}
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
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
      <TabsList aria-label={label} className="print:hidden">
        {presets.map((preset) => (
          <TabsTrigger key={preset} value={preset}>
            {preset}
          </TabsTrigger>
        ))}
      </TabsList>
      <PrintRangeLabel preset={value} />
    </Tabs>
  );
}
