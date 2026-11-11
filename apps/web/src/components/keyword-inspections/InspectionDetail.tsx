"use client";

import { useRef, type Ref } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KeywordInspection } from "@asobeast/shared";
import { Loader2, SearchX } from "lucide-react";
import { toast } from "sonner";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isNotFound, requestKeywordInspection } from "@/lib/api";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { formatCountry, formatDateTime, storeLabel } from "@/lib/format";
import { inspectionPollInterval } from "@/lib/keyword-inspection-polling";
import {
  keywordInspectionKeys,
  keywordInspectionOptions,
  refreshKeywordInspections,
  seedKeywordInspection,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { InspectionDelta } from "./InspectionExtras";
import { InspectionResultsTable } from "./InspectionResultsTable";
import { InspectionCompetition, InspectionScores } from "./InspectionScores";
import {
  InspectionDetailSkeleton,
  InspectionScoresSkeleton,
} from "./skeletons";

function InspectionHeading({
  inspection,
  ref,
}: {
  inspection: KeywordInspection;
  ref: Ref<HTMLHeadingElement>;
}) {
  const when = inspection.completedAt ?? inspection.requestedAt;
  return (
    <header className="flex flex-col gap-0.5">
      <h2 ref={ref} tabIndex={-1} className="text-title text-balance">
        {`“${inspection.keyword}”`}
      </h2>
      <p className="text-sm text-muted-foreground">
        {`${storeLabel(inspection.store)} · ${formatCountry(inspection.country)} · ${formatDateTime(when)}`}
      </p>
    </header>
  );
}

function PendingInspection({
  inspection,
  polling,
  checking,
  onCheck,
}: {
  inspection: KeywordInspection;
  polling: boolean;
  checking: boolean;
  onCheck: (leaving: HTMLButtonElement | null) => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 aria-hidden className="size-4 animate-spin" />
          <span>
            {inspection.startedAt === null
              ? "Waiting for the store queue. Scheduled store work runs first, so this can take a few minutes."
              : "Reading the store. This usually takes under a minute."}
          </span>
        </p>
        {polling ? null : (
          <Button
            ref={button}
            variant="outline"
            size="sm"
            aria-disabled={checking || undefined}
            onClick={() => {
              if (!checking) onCheck(button.current);
            }}
          >
            {checking ? "Checking…" : "Check again"}
          </Button>
        )}
      </div>
      <InspectionScoresSkeleton />
    </>
  );
}

function FailedInspection({
  inspection,
  onRetried,
}: {
  inspection: KeywordInspection;
  onRetried: (
    inspection: KeywordInspection,
    leaving: HTMLButtonElement | null,
  ) => void;
}) {
  const queryClient = useQueryClient();
  const button = useRef<HTMLButtonElement>(null);
  const retry = useMutation({
    mutationFn: () =>
      requestKeywordInspection({
        keyword: inspection.keyword,
        store: inspection.store,
        country: inspection.country,
      }),
    onSuccess: (next) => {
      seedKeywordInspection(queryClient, next);
      onRetried(next, button.current);
    },
    onError: () => toast.error("Could not start the inspection again"),
  });
  const retryOnce = useSingleFlight(retry);
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-4"
    >
      <p className="font-medium">This inspection did not finish.</p>
      {inspection.failure ? (
        <p className="text-sm text-muted-foreground">{inspection.failure}</p>
      ) : null}
      <Button
        ref={button}
        variant="outline"
        aria-disabled={retry.isPending || undefined}
        onClick={() => retryOnce(undefined)}
      >
        {retry.isPending ? "Starting…" : "Try again"}
      </Button>
    </div>
  );
}

function CompletedInspection({
  inspection,
}: {
  inspection: KeywordInspection;
}) {
  return (
    <>
      <InspectionScores inspection={inspection} />
      {inspection.previous ? (
        <InspectionDelta
          inspection={inspection}
          previous={inspection.previous}
        />
      ) : null}
      <section
        aria-labelledby="inspection-results"
        className="flex flex-col gap-1"
      >
        <h3 id="inspection-results" className="text-sm font-medium">
          Search results
        </h3>
        {inspection.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            The store returned no apps for this keyword.
          </p>
        ) : (
          <InspectionResultsTable
            keyword={inspection.keyword}
            results={inspection.results}
            entered={inspection.previous?.entered ?? []}
          />
        )}
      </section>
      <InspectionCompetition inspection={inspection} />
    </>
  );
}

export function InspectionDetail({
  id,
  onInspected,
}: {
  id: string;
  onInspected: (inspection: KeywordInspection) => void;
}) {
  const queryClient = useQueryClient();
  const read = useQuery(keywordInspectionOptions(id));
  const heading = useRef<HTMLHeadingElement>(null);
  const handOffFocus = useFocusAfterCommit();
  if (read.isPending) return <InspectionDetailSkeleton />;
  if (read.isError && isNotFound(read.error)) {
    return (
      <EmptyState
        icon={SearchX}
        title="This inspection no longer exists"
        body="It may have been deleted. Run a new one above."
      />
    );
  }
  if (!read.data) {
    return (
      <InlineQueryError
        message="The inspection could not be loaded."
        read={read}
      />
    );
  }
  const inspection = read.data;
  return (
    <article
      aria-busy={inspection.status === "PENDING"}
      className="flex flex-col gap-6"
    >
      <InspectionHeading inspection={inspection} ref={heading} />
      {inspection.status === "PENDING" ? (
        <PendingInspection
          inspection={inspection}
          polling={
            inspectionPollInterval({
              data: inspection,
              error: read.error,
              dataUpdateCount:
                queryClient.getQueryState(keywordInspectionKeys.detail(id))
                  ?.dataUpdateCount ?? 0,
            }) !== false
          }
          checking={read.isFetching}
          onCheck={(leaving) => {
            handOffFocus(heading.current, leaving);
            void read.refetch();
            void refreshKeywordInspections(queryClient);
          }}
        />
      ) : null}
      {inspection.status === "FAILED" ? (
        <FailedInspection
          inspection={inspection}
          onRetried={(next, leaving) => {
            handOffFocus(heading.current, leaving);
            onInspected(next);
          }}
        />
      ) : null}
      {inspection.status === "DONE" ? (
        <CompletedInspection inspection={inspection} />
      ) : null}
    </article>
  );
}
