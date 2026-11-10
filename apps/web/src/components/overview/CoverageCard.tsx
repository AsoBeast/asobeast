"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useKeywordScope } from "@/components/app-detail/use-market";
import { PANEL_HEADER } from "@/components/dashboard/layout-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { discoveriesHref, discoveriesLine } from "@/lib/keyword-discoveries";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { FOOTER_LINK, LIST_HEAD, LIST_ROW } from "./layout-classes";

const COLUMNS = "grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-2";

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="numeric text-body font-semibold">{value}</dd>
    </div>
  );
}

export function CoverageCard({ id }: { id: string }) {
  const { country, switchable } = useKeywordScope(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, country));
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const coverage = summary.coverage;
  const discoveries = discoveriesLine(summary.discoveries);

  const stats = [
    { label: "Title", value: coverage.inTitle },
    ...(detail.store === "APP_STORE"
      ? [{ label: "Subtitle", value: coverage.inSubtitle }]
      : []),
    { label: "Description", value: coverage.inDescription },
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
          className="flex flex-wrap gap-x-6 gap-y-1 px-2"
        >
          {stats.map((stat) => (
            <CoverageStat key={stat.label} {...stat} />
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
