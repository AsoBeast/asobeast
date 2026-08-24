"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { formatRankPosition } from "@asobeast/shared";
import type { KeywordMover } from "@asobeast/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { appSummaryOptions } from "@/lib/queries";

function MoverList({
  id,
  title,
  movers,
}: {
  id: string;
  title: string;
  movers: KeywordMover[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {movers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No movement this week.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {movers.map((mover) => (
            <li key={mover.keywordId}>
              <Link
                href={`/apps/${id}/rankings?keywords=${mover.keywordId}`}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
              >
                <span className="truncate">{mover.text}</span>
                <span className="flex shrink-0 items-center gap-1 numeric font-mono text-muted-foreground">
                  {formatRankPosition(mover.from, mover.fromDepth)}
                  <ArrowRight className="size-3" />
                  {formatRankPosition(mover.to, mover.toDepth)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MoversCard({ id }: { id: string }) {
  const { data: summary } = useSuspenseQuery(appSummaryOptions(id));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Keyword movers</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        <MoverList id={id} title="Climbers" movers={summary.movers.up} />
        <MoverList id={id} title="Fallers" movers={summary.movers.down} />
      </CardContent>
    </Card>
  );
}
