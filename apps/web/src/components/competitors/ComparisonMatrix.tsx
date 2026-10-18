"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { CollapsibleCard } from "@/components/layout/CollapsibleCard";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { onlyGapsParser } from "@/lib/search-params";
import { ComparisonTable } from "./ComparisonTable";
import { COMPETITOR_SECTION } from "./competitor-sections";

function ComparisonBody({ id, onlyGaps }: { id: string; onlyGaps: boolean }) {
  const { data } = useSuspenseQuery(comparisonOptions(id, onlyGaps));
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  if (data.competitors.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        Add a competitor above to discover keyword gaps — phrases they rank for
        and you do not. One search serves every app, so this costs no extra
        scraping.
      </div>
    );
  }
  if (data.rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        {onlyGaps
          ? "No gaps — you rank everywhere your competitors do."
          : "No comparison data yet. Track keywords and run a daily check to populate positions."}
      </div>
    );
  }
  return (
    <ComparisonTable
      data={data}
      competitors={competitors}
      appId={id}
      onlyGaps={onlyGaps}
    />
  );
}

export function ComparisonMatrix({ id }: { id: string }) {
  const [onlyGaps, setOnlyGaps] = useQueryState("onlyGaps", onlyGapsParser);
  return (
    <CollapsibleCard
      section={COMPETITOR_SECTION.matrix}
      eyebrow="Comparison matrix"
      title="Your position against every competitor"
      actions={
        <div className="flex items-center gap-2">
          <Switch
            id="only-gaps"
            checked={onlyGaps}
            onCheckedChange={(next) => setOnlyGaps(next ? true : null)}
          />
          <Label htmlFor="only-gaps" className="text-sm text-muted-foreground">
            only gaps
          </Label>
        </div>
      }
    >
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <ComparisonBody id={id} onlyGaps={onlyGaps} />
      </Suspense>
    </CollapsibleCard>
  );
}
