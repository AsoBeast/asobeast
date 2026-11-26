"use client";

import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { StageRow } from "@/components/app-detail/StageRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  appDetailOptions,
  firstRunOptions,
  invalidateAppListing,
  invalidateKeywords,
} from "@/lib/queries";
import { useAppLocale } from "@/lib/use-app-locale";
import { FirstPositions } from "./FirstPositions";
import {
  firstRunHeadline,
  firstRunRows,
  listingSettled,
  rankingsAdvanced,
  rankingsTracked,
} from "./first-run-timeline";

export function FirstRunTimeline({ id }: { id: string }) {
  const t = useTranslations("setup");
  const locale = useAppLocale();
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
          <h2 id={headingId}>{firstRunHeadline(data, t)}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul
          aria-labelledby={headingId}
          aria-live="polite"
          className="flex flex-col gap-3"
        >
          {firstRunRows(data, dataUpdatedAt, t, locale).map((row) => (
            <StageRow
              key={row.stage}
              label={row.label}
              ready={row.state === "ready"}
              progress={row.progress}
              detail={row.detail}
            />
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
