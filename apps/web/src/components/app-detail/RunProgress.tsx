"use client";

import { useEffect, useId, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { RunState } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { appRunStatusOptions, invalidateRunResults } from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  pillLabel,
  pillText,
  runAdvanced,
  runRows,
  startedSentence,
} from "@/lib/run-progress";
import { StageRow } from "./StageRow";

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
  const t = useTranslations("jobs");
  const locale = useAppLocale();
  const queryClient = useQueryClient();
  const { data } = useQuery(appRunStatusOptions(appId));
  const previous = useRef(data);

  useEffect(() => {
    if (runAdvanced(previous.current, data)) {
      invalidateRunResults(queryClient, appId);
    }
    previous.current = data;
  }, [appId, data, queryClient]);

  const text = data ? pillText(data, t) : null;
  if (!data || text === null) return null;
  const label = pillLabel(data, t);

  return (
    <>
      <span role="status" className="sr-only">
        {label}
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            aria-label={label}
            className="gap-1.5"
          >
            <StateIcon state={data.state} />
            <span aria-hidden className="numeric hidden sm:inline">
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
            <h3 id={headingId} className="text-dense font-medium">
              {t("progress.title")}
            </h3>
            <p className="text-caption text-muted-foreground">
              {startedSentence(data, { translator: t, locale })}
            </p>
          </div>
          <ul className="flex flex-col gap-3">
            {runRows(data, t).map((row) => (
              <StageRow
                key={row.stage}
                label={row.label}
                ready={row.ready}
                progress={row.progress}
                detail={row.detail}
                states={{
                  ready: t("progress.states.done"),
                  waiting: t("progress.states.collecting"),
                }}
              />
            ))}
          </ul>
          {data.state === "complete" ? null : (
            <p className="text-caption text-muted-foreground">
              {t("progress.queuesMissing")}
            </p>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}
