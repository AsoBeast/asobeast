"use client";

import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import type { SerpSnapshot } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { ExportCsvButton } from "@/components/ExportCsvButton";
import {
  failedRead,
  InlineQueryError,
} from "@/components/layout/InlineQueryError";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatNumber, formatRating } from "@/lib/format";
import { appDetailOptions, serpOptions } from "@/lib/queries";
import { serpParser } from "@/lib/search-params";
import { exportSerp, serpRole, type SerpViewer } from "./serp-csv";

function useSerpViewer(appId: string): SerpViewer {
  const { data } = useQuery(appDetailOptions(appId));
  return { appId, storeAppId: data?.storeAppId };
}

function SerpRows({ appId, data }: { appId: string; data: SerpSnapshot }) {
  const viewer = useSerpViewer(appId);

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
        {data.entries.map((entry) => {
          const role = serpRole(entry, viewer);
          return (
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
                  {role === "you" ? <Badge>You</Badge> : null}
                  {role === "competitor" ? (
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
          );
        })}
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

function SerpBody({ appId, keywordId }: { appId: string; keywordId: string }) {
  const serp = useQuery(serpOptions(keywordId));

  if (failedRead(serp)) {
    return (
      <InlineQueryError message="The top 10 could not be loaded." read={serp} />
    );
  }
  if (!serp.data) return <SerpSkeleton />;
  return <SerpRows appId={appId} data={serp.data} />;
}

function SerpExportButton({
  appId,
  keywordId,
}: {
  appId: string;
  keywordId: string;
}) {
  const { data } = useQuery(serpOptions(keywordId));
  const viewer = useSerpViewer(appId);
  return (
    <ExportCsvButton
      subject="the top 10"
      className="self-start"
      disabled={
        data === undefined ||
        data.entries.length === 0 ||
        viewer.storeAppId === undefined
      }
      onClick={() => {
        if (data) exportSerp(viewer, data);
      }}
    />
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
          {open ? (
            <SerpExportButton appId={appId} keywordId={keywordId} />
          ) : null}
        </SheetHeader>
        {open ? (
          <div className="overflow-y-auto">
            <SerpBody appId={appId} keywordId={keywordId} />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
