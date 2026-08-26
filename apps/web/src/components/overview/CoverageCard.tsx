"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appDetailOptions, appSummaryOptions } from "@/lib/queries";
import { cn } from "@/lib/utils";

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 py-2 text-center">
      <div className="text-lg font-semibold numeric font-mono">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function CoverageCard({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const coverage = summary.coverage;

  const stats = [
    { label: "Title", value: coverage.inTitle },
    ...(detail.store === "APP_STORE"
      ? [{ label: "Subtitle", value: coverage.inSubtitle }]
      : []),
    { label: "Description", value: coverage.inDescription },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata coverage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div
          className={cn(
            "grid gap-2",
            stats.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {stats.map((stat) => (
            <CoverageStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            High-opportunity keywords absent from your metadata
          </p>
          {coverage.uncoveredHighOpportunity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your metadata covers your top opportunities.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {coverage.uncoveredHighOpportunity.map((keyword) => (
                <Link key={keyword.keywordId} href={`/apps/${id}/keywords`}>
                  <Badge variant="secondary" className="gap-1">
                    {keyword.text}
                    <span className="numeric font-mono text-muted-foreground">
                      {Math.round(keyword.opportunity)}
                    </span>
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
