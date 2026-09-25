"use client";

import { Suspense, useId } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { ChangeImpactItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry, formatDate } from "@/lib/format";
import { changeImpactOptions, keywordCountriesOptions } from "@/lib/queries";
import { changeDaysParser } from "@/lib/search-params";
import { ChangeImpactWindowTile } from "./ChangeImpactWindowTile";
import { FIELD_LABELS } from "./ChangeTimeline";
import { impactScopeLine } from "./change-impact-copy";
import { ChangeImpactSkeleton } from "./skeletons";

interface ImpactScope {
  id: string;
  days: number;
  market: string;
}

function ChangeImpactRow({ item }: { item: ChangeImpactItem }) {
  return (
    <li className="flex flex-col gap-3 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body font-medium">{formatDate(item.changedOn)}</h3>
        {item.fields.map((field) => (
          <Badge key={field} variant="outline">
            {FIELD_LABELS[field]}
          </Badge>
        ))}
      </div>
      {item.baselineDate === null ? (
        <p className="text-body text-muted-foreground">
          No rank check just before this change, so its effect cannot be
          measured.
        </p>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">
            Compared with the rank check on {formatDate(item.baselineDate)}
          </p>
          <ul className="grid gap-3 sm:grid-cols-3">
            {item.windows.map((impact) => (
              <ChangeImpactWindowTile key={impact.days} impact={impact} />
            ))}
          </ul>
        </>
      )}
    </li>
  );
}

function ChangeImpactList({ id, days, market }: ImpactScope) {
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
          <ChangeImpactRow key={item.changedOn} item={item} />
        ))}
      </ul>
    </div>
  );
}

function ChangeImpactBody({ id, days, market }: ImpactScope) {
  const { data: markets } = useSuspenseQuery(keywordCountriesOptions(id));
  const tracked =
    markets.find((entry) => entry.country === market)?.keywordCount ?? 0;

  if (tracked === 0) {
    return (
      <EmptyState
        title={`No keywords tracked in ${formatCountry(market)} yet`}
        body="Track keywords in this market to see how changes to your listing move them."
      />
    );
  }

  return (
    <Suspense fallback={<ChangeImpactSkeleton />}>
      <ChangeImpactList id={id} days={days} market={market} />
    </Suspense>
  );
}

export function ChangeImpactCard({
  id,
  homeCountry,
}: {
  id: string;
  homeCountry: string;
}) {
  const titleId = useId();
  const [days] = useQueryState("days", changeDaysParser);

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardDescription>Change impact</CardDescription>
        <CardTitle asChild>
          <h2 id={titleId}>How rankings moved after each change</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChangeImpactSkeleton />}>
          <ChangeImpactBody id={id} days={days} market={homeCountry} />
        </Suspense>
      </CardContent>
    </Card>
  );
}
