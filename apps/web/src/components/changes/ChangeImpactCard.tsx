"use client";

import { Suspense, useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type {
  ChangeImpactItem,
  ChangeImpactWindow,
  KeywordCountrySummary,
  Store,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCountry, formatDate } from "@/lib/format";
import { changeImpactOptions, keywordCountriesOptions } from "@/lib/queries";
import { changeDaysParser, countryParser } from "@/lib/search-params";
import { ChangeImpactWindowTile, FunnelFacts } from "./ChangeImpactWindowTile";
import { CHANGE_FIELD_LABELS } from "@/lib/change-fields";
import { impactScopeLine, windowTitle } from "./change-impact-copy";
import { ChangeImpactSkeleton } from "./skeletons";
import { VisibilityHelp } from "@/components/visibility/VisibilityHelp";

interface ImpactScope {
  id: string;
  store: Store;
  days: number;
  market: string;
}

function ChangeImpactRow({
  item,
  store,
}: {
  item: ChangeImpactItem;
  store: Store;
}) {
  return (
    <li className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body font-medium">{formatDate(item.changedOn)}</h3>
        {item.fields.map((field) => (
          <Badge key={field} variant="outline">
            {CHANGE_FIELD_LABELS[field]}
          </Badge>
        ))}
      </div>
      {item.baselineDate === null ? (
        <>
          <p className="text-body text-muted-foreground">
            No rank check just before this change, so its effect on rankings
            cannot be measured.
          </p>
          <FunnelOnlyTiles windows={item.windows} store={store} />
        </>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            Compared with the rank check on {formatDate(item.baselineDate)}
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {item.windows.map((impact) => (
              <ChangeImpactWindowTile
                key={impact.days}
                impact={impact}
                store={store}
              />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

function FunnelOnlyTiles({
  windows,
  store,
}: {
  windows: ChangeImpactWindow[];
  store: Store;
}) {
  const funnels = windows.filter((impact) => impact.funnel);
  if (funnels.length === 0) return null;
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {funnels.map((impact) => (
        <li
          key={impact.days}
          className="flex flex-col gap-2 rounded-lg border p-3"
        >
          <h4 className="text-body font-medium">{windowTitle(impact.days)}</h4>
          <FunnelFacts impact={impact} store={store} />
        </li>
      ))}
    </ul>
  );
}

function ChangeImpactList({ id, store, days, market }: ImpactScope) {
  const { data } = useSuspenseQuery(changeImpactOptions(id, days, market));

  if (data.items.length === 0) {
    return (
      <EmptyState
        title={`No changes to your listing in the last ${days} days`}
        body="A change appears here once a refresh detects an edit to your own listing. Widen the window to look further back."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-body text-muted-foreground">
        {impactScopeLine({
          days,
          totalChanges: data.totalChanges,
          shown: data.items.length,
        })}
      </p>
      <ul className="flex flex-col gap-4">
        {data.items.map((item) => (
          <ChangeImpactRow key={item.changedOn} item={item} store={store} />
        ))}
      </ul>
    </div>
  );
}

function ImpactMarketSelect({
  markets,
  market,
  onChange,
}: {
  markets: KeywordCountrySummary[];
  market: string;
  onChange: (country: string) => void;
}) {
  const selectId = useId();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={selectId}>Market</Label>
      <Select value={market} onValueChange={onChange}>
        <SelectTrigger id={selectId} className="w-[220px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {markets.map((entry) => (
            <SelectItem key={entry.country} value={entry.country}>
              {entry.country.toUpperCase()} · {formatCountry(entry.country)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangeImpactBody({
  id,
  store,
  days,
  market,
  onMarketChange,
}: ImpactScope & { onMarketChange: (country: string) => void }) {
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const tracked =
    markets.find((entry) => entry.country === market)?.keywordCount ?? 0;

  return (
    <div className="flex flex-col gap-4">
      {markets.length > 1 ? (
        <ImpactMarketSelect
          markets={markets}
          market={market}
          onChange={onMarketChange}
        />
      ) : null}
      {tracked === 0 ? (
        <EmptyState
          title={`No keywords tracked in ${formatCountry(market)} yet`}
          body="Track keywords in this market to see how changes to your listing move them."
        />
      ) : (
        <Suspense fallback={<ChangeImpactSkeleton />}>
          <ChangeImpactList id={id} store={store} days={days} market={market} />
        </Suspense>
      )}
    </div>
  );
}

export function ChangeImpactCard({
  id,
  store,
  homeCountry,
}: {
  id: string;
  store: Store;
  homeCountry: string;
}) {
  const titleId = useId();
  const [days] = useQueryState("days", changeDaysParser);
  const [country, setCountry] = useQueryState("country", countryParser);
  const market = country || homeCountry;

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardDescription>Change impact</CardDescription>
        <CardTitle asChild>
          <h2 id={titleId}>How rankings moved after each change</h2>
        </CardTitle>
        <CardAction>
          <VisibilityHelp note="Here visibility covers only this market's keywords checked on both days, each weighted by its popularity on the last check before the change, so only positions move it." />
        </CardAction>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeImpactSkeleton />}>
          <ChangeImpactBody
            id={id}
            store={store}
            days={days}
            market={market}
            onMarketChange={(next) =>
              void setCountry(next === homeCountry ? null : next)
            }
          />
        </Suspense>
      </CardContent>
    </Card>
  );
}
