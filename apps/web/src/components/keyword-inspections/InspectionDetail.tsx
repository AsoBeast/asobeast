"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KeywordInspection } from "@asobeast/shared";
import { Loader2, SearchX } from "lucide-react";
import { toast } from "sonner";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { isNotFound, requestKeywordInspection } from "@/lib/api";
import { formatCountry, formatDateTime, storeLabel } from "@/lib/format";
import { keywordInspectionOptions, seedKeywordInspection } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { InspectionDelta } from "./InspectionExtras";
import { InspectionResultsTable } from "./InspectionResultsTable";
import { InspectionCompetition, InspectionScores } from "./InspectionScores";
import {
  InspectionDetailSkeleton,
  InspectionScoresSkeleton,
} from "./skeletons";

function InspectionHeading({ inspection }: { inspection: KeywordInspection }) {
  const when = inspection.completedAt ?? inspection.requestedAt;
  return (
    <header className="flex flex-col gap-0.5">
      <h2 className="text-title text-balance">“{inspection.keyword}”</h2>
      <p className="text-sm text-muted-foreground">
        {storeLabel(inspection.store)} · {formatCountry(inspection.country)} ·{" "}
        {formatDateTime(when)}
      </p>
    </header>
  );
}

function FailedInspection({
  inspection,
  onInspected,
}: {
  inspection: KeywordInspection;
  onInspected: (inspection: KeywordInspection) => void;
}) {
  const queryClient = useQueryClient();
  const retry = useMutation({
    mutationFn: () =>
      requestKeywordInspection({
        keyword: inspection.keyword,
        store: inspection.store,
        country: inspection.country,
      }),
    onSuccess: (next) => {
      seedKeywordInspection(queryClient, next);
      onInspected(next);
    },
    onError: () => toast.error("Could not start the inspection again"),
  });
  const retryOnce = useSingleFlight(retry);
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 p-4"
    >
      <p className="font-medium">
        The store could not be read for this inspection.
      </p>
      {inspection.failure ? (
        <p className="text-sm text-muted-foreground">{inspection.failure}</p>
      ) : null}
      <Button
        variant="outline"
        disabled={retry.isPending}
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
  const read = useQuery(keywordInspectionOptions(id));
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
      <InspectionHeading inspection={inspection} />
      {inspection.status === "PENDING" ? (
        <>
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 aria-hidden className="size-4 animate-spin" />
            Reading the store. This usually takes a few seconds.
          </p>
          <InspectionScoresSkeleton />
        </>
      ) : null}
      {inspection.status === "FAILED" ? (
        <FailedInspection inspection={inspection} onInspected={onInspected} />
      ) : null}
      {inspection.status === "DONE" ? (
        <CompletedInspection inspection={inspection} />
      ) : null}
    </article>
  );
}
