"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { serpOptions } from "@/lib/queries";
import { serpParser } from "@/lib/search-params";

function SerpRows({ appId, keywordId }: { appId: string; keywordId: string }) {
  const { data } = useSuspenseQuery(serpOptions(keywordId));

  if (data.entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-body text-muted-foreground">
        Not checked yet — run the daily pipeline to capture the top results.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Captured {formatDate(data.date)}
      </p>
      <ol className="flex flex-col gap-1">
        {data.entries.map((entry) => (
          <li
            key={entry.position}
            className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/50"
          >
            <span className="w-6 shrink-0 pt-0.5 text-right font-medium numeric font-mono text-muted-foreground">
              {entry.position}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{entry.title}</span>
                {entry.appId === appId ? <Badge>You</Badge> : null}
                {entry.isCompetitor ? (
                  <Badge variant="secondary">Competitor</Badge>
                ) : null}
              </span>
              {entry.developer ? (
                <span className="truncate text-xs text-muted-foreground">
                  {entry.developer}
                </span>
              ) : null}
            </div>
            {entry.ratingAvg !== null ? (
              <span className="shrink-0 pt-0.5 text-xs numeric font-mono text-muted-foreground">
                {formatRating(entry.ratingAvg)}
                {entry.ratingCount !== null
                  ? ` · ${formatNumber(entry.ratingCount)}`
                  : ""}
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

function SerpSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-3 w-32" />
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-2 py-2">
          <Skeleton className="size-5" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SerpSheet({ appId }: { appId: string }) {
  const [keywordId, setKeywordId] = useQueryState("serp", serpParser);
  const open = keywordId.length > 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) void setKeywordId("");
      }}
    >
      <SheetContent aria-describedby="serp-description">
        <SheetHeader>
          <SheetTitle>Top 10 search results</SheetTitle>
          <SheetDescription id="serp-description">
            The apps ranking for this keyword on the latest daily check.
          </SheetDescription>
        </SheetHeader>
        {open ? (
          <div className="overflow-y-auto">
            <Suspense fallback={<SerpSkeleton />}>
              <SerpRows appId={appId} keywordId={keywordId} />
            </Suspense>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
