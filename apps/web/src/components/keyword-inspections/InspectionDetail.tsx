"use client";

import { useRef, type ReactNode, type Ref } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  KeywordInspection,
  KeywordInspectionSummary,
} from "@asobeast/shared";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { PANEL_BLEED, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { isNotFound, requestKeywordInspection } from "@/lib/api";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { formatDateTime } from "@/lib/format";
import { inspectionPollInterval } from "@/lib/keyword-inspection-polling";
import {
  keywordInspectionKeys,
  keywordInspectionOptions,
  refreshKeywordInspections,
  seedKeywordInspection,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { InspectionNotes } from "./InspectionExtras";
import { InspectionResultsTable } from "./InspectionResultsTable";
import {
  InspectionCompetition,
  InspectionFigures,
  InspectionSource,
  SUB_HEADER,
} from "./InspectionScores";
import {
  otherStorefronts,
  storefrontCode,
  storefrontName,
} from "./inspection-format";
import {
  InspectionDetailSkeleton,
  InspectionScoresSkeleton,
} from "./skeletons";

function DetailPanel({
  heading,
  storefront,
  footer,
  children,
}: {
  heading: ReactNode;
  storefront?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>{heading}</CardTitle>
        {storefront ? (
          <CardAction className="self-center text-label text-faint-foreground">
            {storefront}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className={PANEL_BLEED}>{children}</CardContent>
      {footer ? (
        <CardFooter className="flex-wrap justify-between gap-x-4 gap-y-1">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function EmptyInspection({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <DetailPanel heading={<h2>Inspection</h2>}>
      <EmptyState title={title} body={body} className="px-6 py-8" />
    </DetailPanel>
  );
}

function KeywordHeading({
  inspection,
  ref,
}: {
  inspection: KeywordInspection;
  ref: Ref<HTMLHeadingElement>;
}) {
  return (
    <h2
      ref={ref}
      tabIndex={-1}
      className="min-w-0 rounded-sm text-balance wrap-anywhere outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {`“${inspection.keyword}”`}
    </h2>
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
      <div className="flex flex-col items-start gap-3 p-4">
        <p
          role="status"
          className="flex items-start gap-2 text-dense text-muted-foreground"
        >
          <Loader2
            aria-hidden
            className="mt-0.5 size-4 shrink-0 animate-spin"
          />
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
    <div role="alert" className="flex flex-col items-start gap-2 p-4">
      <p className="text-body font-medium">This inspection did not finish.</p>
      {inspection.failure ? (
        <p className="text-body text-muted-foreground">{inspection.failure}</p>
      ) : null}
      <Button
        ref={button}
        variant="outline"
        className="mt-1"
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
  items,
  onSelect,
}: {
  inspection: KeywordInspection;
  items: readonly KeywordInspectionSummary[];
  onSelect: (id: string) => void;
}) {
  const at = inspection.completedAt ?? inspection.requestedAt;
  return (
    <>
      <InspectionFigures
        inspection={inspection}
        previous={inspection.previous}
      />
      <InspectionNotes
        inspection={inspection}
        elsewhere={otherStorefronts(items, inspection)}
        onSelect={onSelect}
      />
      <InspectionCompetition inspection={inspection} />
      <section aria-labelledby="inspection-results">
        <div className={SUB_HEADER}>
          <h3 id="inspection-results">Search results</h3>
          {inspection.results.length > 0 ? (
            <span className="numeric text-faint-foreground">
              {`Top ${Math.min(10, inspection.results.length)} of ${inspection.results.length}`}
            </span>
          ) : null}
        </div>
        {inspection.results.length === 0 ? (
          <p className="px-4 py-6 text-center text-body text-muted-foreground">
            The store returned no apps for this keyword.
          </p>
        ) : (
          <InspectionResultsTable
            keyword={inspection.keyword}
            results={inspection.results}
            entered={inspection.previous?.entered ?? []}
            at={at}
          />
        )}
      </section>
    </>
  );
}

function inspectionFooter(inspection: KeywordInspection): ReactNode {
  const place = storefrontName(inspection.store, inspection.country);
  const when =
    inspection.status === "DONE" && inspection.completedAt
      ? formatDateTime(inspection.completedAt)
      : `requested ${formatDateTime(inspection.requestedAt)}`;
  return (
    <>
      <span>{`${place} · ${when}`}</span>
      {inspection.status === "DONE" ? (
        <InspectionSource inspection={inspection} />
      ) : null}
    </>
  );
}

export function InspectionDetail({
  id,
  items,
  onInspected,
  onSelect,
}: {
  id: string;
  items: readonly KeywordInspectionSummary[];
  onInspected: (inspection: KeywordInspection) => void;
  onSelect: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const read = useQuery(keywordInspectionOptions(id));
  const heading = useRef<HTMLHeadingElement>(null);
  const handOffFocus = useFocusAfterCommit();
  if (read.isPending) {
    return (
      <DetailPanel heading={<h2>Inspection</h2>}>
        <InspectionDetailSkeleton />
      </DetailPanel>
    );
  }
  if (read.isError && isNotFound(read.error)) {
    return (
      <EmptyInspection
        title="This inspection no longer exists"
        body="It may have been deleted. Run a new one above."
      />
    );
  }
  if (!read.data) {
    return (
      <DetailPanel heading={<h2>Inspection</h2>}>
        <div className="p-4">
          <InlineQueryError
            message="The inspection could not be loaded."
            read={read}
          />
        </div>
      </DetailPanel>
    );
  }
  const inspection = read.data;
  return (
    <DetailPanel
      heading={<KeywordHeading inspection={inspection} ref={heading} />}
      storefront={storefrontCode(inspection.store, inspection.country)}
      footer={inspectionFooter(inspection)}
    >
      <article aria-busy={inspection.status === "PENDING"}>
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
          <CompletedInspection
            inspection={inspection}
            items={items}
            onSelect={onSelect}
          />
        ) : null}
      </article>
    </DetailPanel>
  );
}
