"use client";

import { Suspense, useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { MarketSwitcher } from "@/components/app-detail/MarketSwitcher";
import { PageHeader } from "@/components/layout/PageHeader";
import { LEDE } from "@/components/layout/panel-classes";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatCountry } from "@/lib/format";
import { keywordCountriesOptions } from "@/lib/queries";
import { CHANGE_WINDOWS } from "@/lib/ranges";
import { changeDaysParser, countryParser } from "@/lib/search-params";
import { changesLede } from "./changes-lede";
import { LedeSkeleton } from "./skeletons";
import { useChangeEvents, useChangeImpact } from "./use-change-view";

function ImpactMarketSelect({
  id,
  homeCountry,
}: {
  id: string;
  homeCountry: string;
}) {
  const selectId = useId();
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const [country, setCountry] = useQueryState("country", countryParser);
  if (markets.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={selectId}>Market</Label>
      <Select
        value={country || homeCountry}
        onValueChange={(next) =>
          void setCountry(next === homeCountry ? null : next)
        }
      >
        <SelectTrigger id={selectId} className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {markets.map((entry) => (
            <SelectItem key={entry.country} value={entry.country}>
              {`${entry.country.toUpperCase()} · ${formatCountry(entry.country)}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangesLede({ id, homeCountry }: { id: string; homeCountry: string }) {
  const { events, days, homeListing } = useChangeEvents(id);
  const impact = useChangeImpact(id, days, homeCountry);
  const parts = changesLede({
    events,
    impact: homeListing ? impact : null,
    days,
  });

  return (
    <p className={LEDE}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={part.strong ? "font-medium text-foreground" : undefined}
        >
          {part.text}
        </span>
      ))}
    </p>
  );
}

export function ChangesHeader({
  id,
  homeCountry,
}: {
  id: string;
  homeCountry: string;
}) {
  const [days, setDays] = useQueryState("days", changeDaysParser);

  return (
    <PageHeader title="Changes" titleHidden>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Tabs
          value={String(days)}
          onValueChange={(next) => {
            const chosen = CHANGE_WINDOWS.find(
              (option) => String(option) === next,
            );
            if (chosen !== undefined) void setDays(chosen);
          }}
        >
          <TabsList aria-label="Window">
            {CHANGE_WINDOWS.map((option) => (
              <TabsOption key={option} value={String(option)}>
                {`${option}d`}
              </TabsOption>
            ))}
          </TabsList>
        </Tabs>
        <Suspense fallback={null}>
          <ImpactMarketSelect id={id} homeCountry={homeCountry} />
        </Suspense>
        <Suspense fallback={null}>
          <MarketSwitcher id={id} />
        </Suspense>
      </div>
      <Suspense fallback={<LedeSkeleton />}>
        <ChangesLede id={id} homeCountry={homeCountry} />
      </Suspense>
    </PageHeader>
  );
}
