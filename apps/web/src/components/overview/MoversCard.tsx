"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { KeywordMover } from "@asobeast/shared";
import { MoverList } from "@/components/rankings/MoverRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMarket } from "@/components/app-detail/use-market";
import { appSummaryOptions } from "@/lib/queries";

export function MoversCard({ id }: { id: string }) {
  const { scope } = useMarket(id);
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id, scope));
  const rankingsHref = (mover: KeywordMover) =>
    `/apps/${id}/rankings?keywords=${mover.keywordId}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword movers</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <MoverList
          title="Climbers"
          movers={summary.movers.up}
          renderHref={rankingsHref}
        />
        <MoverList
          title="Fallers"
          movers={summary.movers.down}
          renderHref={rankingsHref}
        />
      </CardContent>
    </Card>
  );
}
