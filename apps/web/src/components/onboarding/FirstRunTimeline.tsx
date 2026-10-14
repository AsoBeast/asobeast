"use client";

import { useEffect, useId, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  appDetailOptions,
  firstRunOptions,
  invalidateAppListing,
  invalidateKeywords,
} from "@/lib/queries";
import { FirstPositions } from "./FirstPositions";
import {
  firstRunHeadline,
  firstRunRows,
  listingSettled,
  rankingsAdvanced,
  rankingsTracked,
  type FirstRunRow,
} from "./first-run-timeline";

function StageRow({ row }: { row: FirstRunRow }) {
  const ready = row.state === "ready";
  const Icon = ready ? CheckCircle2 : LoaderCircle;

  return (
    <li className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={
          ready
            ? "mt-0.5 size-4 shrink-0 text-muted-foreground"
            : "mt-0.5 size-4 shrink-0 animate-spin text-primary"
        }
      />
      <div className="flex flex-col gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-medium">
          <span>{row.label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {ready ? "Ready" : "Waiting"}
            {row.progress ? ` · ${row.progress}` : ""}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{row.detail}</p>
      </div>
    </li>
  );
}

export function FirstRunTimeline({ id }: { id: string }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const { data, dataUpdatedAt } = useQuery(firstRunOptions(id));
  const { data: app } = useQuery(appDetailOptions(id));
  const previous = useRef(data);

  useEffect(() => {
    if (listingSettled(previous.current, data)) {
      invalidateAppListing(queryClient, id);
    }
    if (rankingsAdvanced(previous.current, data)) {
      invalidateKeywords(queryClient, id);
    }
    previous.current = data;
  }, [data, id, queryClient]);

  if (!data || data.complete) {
    return null;
  }

  return (
    <Card className="print:hidden">
      <CardHeader aria-live="polite">
        <CardTitle asChild>
          <h2 id={headingId}>{firstRunHeadline(data)}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul
          aria-labelledby={headingId}
          aria-live="polite"
          className="flex flex-col gap-3"
        >
          {firstRunRows(data, dataUpdatedAt).map((row) => (
            <StageRow key={row.stage} row={row} />
          ))}
        </ul>
        {app && rankingsTracked(data) ? (
          <>
            <Separator />
            <FirstPositions id={id} country={app.country} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
