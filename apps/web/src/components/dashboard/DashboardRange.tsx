"use client";

import { CalendarDays } from "lucide-react";
import { useTranslations } from "next-intl";
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

export function DashboardRange() {
  const t = useTranslations("dashboard");
  const [range, setRange] = useQueryState("range", dashboardRangeParser);
  const label = (days: number) => t("range.label", { days });
  return (
    <Select
      value={String(range)}
      onValueChange={(next) => void setRange(dashboardRangeParser.parse(next))}
    >
      <SelectTrigger aria-label={t("range.aria", { range: label(range) })}>
        <CalendarDays aria-hidden className="text-muted-foreground" />
        <SelectValue>{label(range)}</SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {PORTFOLIO_HISTORY_DAYS.map((days) => (
          <SelectItem key={days} value={String(days)}>
            {label(days)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
