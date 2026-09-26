"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { comparisonOptions, competitorsOptions } from "@/lib/queries";
import { onlyGapsParser } from "@/lib/search-params";
import { ComparisonTable } from "./ComparisonTable";

export function ComparisonMatrix({ id }: { id: string }) {
  const [onlyGaps, setOnlyGaps] = useQueryState("onlyGaps", onlyGapsParser);
  const { data } = useSuspenseQuery(comparisonOptions(id, onlyGaps));
  const { data: competitors } = useSuspenseQuery(competitorsOptions(id));
  return (
    <Card>
      <CardHeader>
        <CardDescription>Comparison matrix</CardDescription>
        <CardTitle>Your position against every competitor</CardTitle>
        <div className="flex items-center gap-2 pt-1">
          <Switch
            id="only-gaps"
            checked={onlyGaps}
            onCheckedChange={(next) => setOnlyGaps(next ? true : null)}
          />
          <Label htmlFor="only-gaps" className="text-sm text-muted-foreground">
            only gaps
          </Label>
        </div>
      </CardHeader>
      <CardContent>
        {data.competitors.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Add a competitor above to discover keyword gaps — phrases they rank
            for and you do not. One search serves every app, so this costs no
            extra scraping.
          </div>
        ) : data.rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {onlyGaps
              ? "No gaps — you rank everywhere your competitors do."
              : "No comparison data yet. Track keywords and run a daily check to populate positions."}
          </div>
        ) : (
          <ComparisonTable
            data={data}
            competitors={competitors}
            appId={id}
            onlyGaps={onlyGaps}
          />
        )}
      </CardContent>
    </Card>
  );
}
