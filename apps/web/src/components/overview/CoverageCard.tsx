"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appSummaryOptions } from "@/lib/queries";

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
  const coverage = summary.coverage;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Metadata coverage</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <CoverageStat label="Title" value={coverage.inTitle} />
          <CoverageStat label="Subtitle" value={coverage.inSubtitle} />
          <CoverageStat label="Description" value={coverage.inDescription} />
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
