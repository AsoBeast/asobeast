"use client";

import { useId } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { firstRunOptions } from "@/lib/queries";
import {
  firstRunHeadline,
  firstRunRows,
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
  const { data } = useQuery(firstRunOptions(id));

  if (!data || data.complete) {
    return null;
  }

  return (
    <Card aria-live="polite">
      <CardHeader>
        <CardTitle asChild>
          <h2 id={headingId}>{firstRunHeadline(data)}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul aria-labelledby={headingId} className="flex flex-col gap-3">
          {firstRunRows(data).map((row) => (
            <StageRow key={row.stage} row={row} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
