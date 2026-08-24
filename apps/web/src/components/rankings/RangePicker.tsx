"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function RangePicker<T extends string>({
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
      <TabsList aria-label={label}>
        {presets.map((preset) => (
          <TabsTrigger key={preset} value={preset}>
            {preset}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
