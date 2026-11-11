"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import {
  FOOTER_LINK,
  LIST_HEAD,
  LIST_ROW,
  PANEL_HEADER,
} from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import { discoveriesHref, discoveriesLine } from "@/lib/keyword-discoveries";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2";

const PERCENT = 100;

function CoverageField({
  label,
  found,
  tracked,
}: {
  label: string;
  found: number;
  tracked: number;
}) {
  const share = tracked === 0 ? 0 : Math.min(found / tracked, 1);
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="contents">
        <span
          aria-hidden
          className="h-2 overflow-hidden rounded-full border border-border print:hidden"
        >
          <span
            data-slot="coverage-bar"
            className="block h-full bg-chart-tint"
            style={{ width: `${Math.round(share * PERCENT)}%` }}
          />
        </span>
        <span className="numeric text-right text-dense">
          <span className="font-semibold">{formatNumber(found)}</span>
          <span className="text-muted-foreground">{` of ${formatNumber(tracked)}`}</span>
        </span>
      </dd>
    </div>
  );
}

export function CoverageCard({ id }: { id: string }) {
  const { country, switchable } = useKeywordScope(id);
  const { data: market } = useSuspenseQuery(appSummaryOptions(id, country));
  const { data: everyMarket } = useSuspenseQuery(appSummaryOptions(id));
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const coverage = everyMarket.coverage;
  const discoveries = discoveriesLine(market.discoveries);

  const fields = [
    { label: "Title", found: coverage.inTitle },
    ...(detail.store === "APP_STORE"
      ? [{ label: "Subtitle", found: coverage.inSubtitle }]
      : []),
    { label: "Description", found: coverage.inDescription },
  ];

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Metadata coverage</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-2">
        <dl
          aria-label="Tracked keywords found in each field"
          className="flex flex-col gap-2 px-2"
        >
          {fields.map((field) => (
            <CoverageField
              key={field.label}
              {...field}
              tracked={everyMarket.trackedKeywords}
            />
          ))}
        </dl>
        {coverage.uncoveredHighOpportunity.length === 0 ? (
          <p className="px-2 text-body text-muted-foreground">
            Your metadata covers your top opportunities.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <div aria-hidden className={cn(COLUMNS, LIST_HEAD)}>
              <span>Not in your metadata</span>
              <span className="text-right">Opportunity</span>
            </div>
            <ul
              aria-label="High-opportunity keywords absent from your metadata"
              className="flex flex-col"
            >
              {coverage.uncoveredHighOpportunity.map((keyword) => (
                <li key={keyword.keywordId}>
                  <Link
                    href={`/apps/${id}/keywords`}
                    className={cn(COLUMNS, LIST_ROW)}
                  >
                    <span translate="no" className="truncate font-medium">
                      {keyword.text}
                    </span>
                    <span className="numeric text-right">
                      <span className="sr-only">Opportunity </span>
                      <span>{Math.round(keyword.opportunity)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      {switchable || discoveries ? (
        <CardFooter className="flex-wrap justify-between gap-y-1">
          {switchable ? (
            <span>All markets, judged against the home listing</span>
          ) : null}
          {discoveries ? (
            <Link href={discoveriesHref(id, country)} className={FOOTER_LINK}>
              {discoveries}
            </Link>
          ) : null}
        </CardFooter>
      ) : null}
    </Card>
  );
}
