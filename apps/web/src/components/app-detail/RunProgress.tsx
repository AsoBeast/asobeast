"use client";

import { useEffect, useId, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, LoaderCircle } from "lucide-react";
import type { RunState } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { appRunStatusOptions, invalidateAppListing } from "@/lib/queries";
import {
  pillLabel,
  pillText,
  runAdvanced,
  runRows,
  startedSentence,
} from "@/lib/run-progress";
import { StageRow } from "./StageRow";

const RUN_STATES = { ready: "Done", waiting: "Collecting" };

function StateIcon({ state }: { state: RunState }) {
  if (state === "complete") {
    return <CheckCircle2 aria-hidden className="text-muted-foreground" />;
  }
  if (state === "delayed") {
    return <Clock aria-hidden className="text-warning" />;
  }
  return (
    <LoaderCircle aria-hidden className="animate-spin text-muted-foreground" />
  );
}

export function RunProgress({ appId }: { appId: string }) {
  const headingId = useId();
  const queryClient = useQueryClient();
  const { data } = useQuery(appRunStatusOptions(appId));
  const previous = useRef(data);

  useEffect(() => {
    if (runAdvanced(previous.current, data)) {
      invalidateAppListing(queryClient, appId);
    }
    previous.current = data;
  }, [appId, data, queryClient]);

  const text = data ? pillText(data) : null;
  if (!data || text === null) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={pillLabel(data)}
          className="gap-1.5"
        >
          <StateIcon state={data.state} />
          <span aria-live="polite" className="numeric hidden sm:inline">
            {text}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        aria-labelledby={headingId}
        className="flex w-80 flex-col gap-3"
      >
        <div className="flex flex-col gap-0.5">
          <h3 id={headingId} className="text-sm font-medium">
            Today&rsquo;s run
          </h3>
          <p className="text-caption text-muted-foreground">
            {startedSentence(data)}
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {runRows(data).map((row) => (
            <StageRow
              key={row.stage}
              label={row.label}
              ready={row.ready}
              progress={row.progress}
              detail={row.detail}
              states={RUN_STATES}
            />
          ))}
        </ul>
        {data.state === "complete" ? null : (
          <p className="text-caption text-muted-foreground">
            Run daily queues what is still missing.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
