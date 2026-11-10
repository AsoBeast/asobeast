"use client";

import { CalendarDays } from "lucide-react";
import { useQueryState } from "nuqs";
import { PORTFOLIO_HISTORY_DAYS } from "@asobeast/shared";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { dashboardRangeParser } from "@/lib/search-params";

const rangeLabel = (days: number): string => `Last ${days} days`;

export function DashboardRange() {
  const [range, setRange] = useQueryState("range", dashboardRangeParser);
  return (
    <Select
      value={String(range)}
      onValueChange={(next) => void setRange(dashboardRangeParser.parse(next))}
    >
      <SelectTrigger aria-label={`Dashboard range, ${rangeLabel(range)}`}>
        <CalendarDays aria-hidden className="text-muted-foreground" />
        <SelectValue>{rangeLabel(range)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {PORTFOLIO_HISTORY_DAYS.map((days) => (
          <SelectItem key={days} value={String(days)}>
            {rangeLabel(days)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
