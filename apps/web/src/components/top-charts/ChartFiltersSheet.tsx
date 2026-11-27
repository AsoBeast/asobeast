"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  ChartCompareFilter,
  ChartCountryFilter,
  ChartDeviceFilter,
  ChartGenreFilter,
  ChartKindFilter,
  ChartLayoutFilter,
  type ChartFilterProps,
} from "./chart-filter-controls";
import { showsDevice } from "./chart-filters";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden className="text-caption text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

export function ChartFiltersSheet({
  active,
  ...filters
}: ChartFilterProps & { active: number }) {
  const t = useTranslations("topCharts");
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <ListFilter aria-hidden />
          {t("filters")}
          {active > 0 ? (
            <Badge variant="secondary" className="numeric">
              {active}
            </Badge>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80svh]">
        <SheetHeader>
          <SheetTitle>{t("filters")}</SheetTitle>
          <SheetDescription>{t("filterDescription")}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-start gap-4">
          <Field label={t("country")}>
            <ChartCountryFilter {...filters} />
          </Field>
          <Field label={t("category")}>
            <ChartGenreFilter {...filters} />
          </Field>
          {showsDevice(filters.chart.store) ? (
            <Field label={t("device")}>
              <ChartDeviceFilter {...filters} />
            </Field>
          ) : null}
          {filters.view === "table" ? (
            <Field label={t("chart")}>
              <ChartKindFilter {...filters} />
            </Field>
          ) : null}
          <Field label={t("compare")}>
            <ChartCompareFilter {...filters} />
          </Field>
          <Field label={t("layout")}>
            <ChartLayoutFilter {...filters} />
          </Field>
        </div>
      </SheetContent>
    </Sheet>
  );
}
