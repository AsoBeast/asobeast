import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ALERT_DAY_HEADING,
  ALERT_ROW,
  ALERT_ROW_APP,
  ALERT_ROW_GLYPH,
  ALERT_ROW_META,
  ALERT_ROW_SENTENCE,
  ALERT_ROW_TEXT,
  ALERT_ROW_TIME,
  ALERT_ROWS,
} from "./alert-row-classes";

const SKELETON_SENTENCES = [
  "w-3/5",
  "w-1/2",
  "w-2/3",
  "w-2/5",
  "w-3/5",
  "w-1/2",
  "w-2/3",
  "w-2/5",
];

const EMPTY_STATE = "px-4 py-8";

function TextLine({ type, width }: { type: string; width: string }) {
  return (
    <div className={type}>
      <Skeleton
        shape="text"
        className={cn("inline-block align-middle", width)}
      />
    </div>
  );
}

function RowSkeleton({ sentence }: { sentence: string }) {
  return (
    <div data-feed-row className={ALERT_ROW}>
      <div className={ALERT_ROW_GLYPH}>
        <Skeleton className="size-4" />
      </div>
      <div className={ALERT_ROW_SENTENCE}>
        <TextLine type={cn(ALERT_ROW_TEXT, "flex-1")} width={sentence} />
      </div>
      <div className={ALERT_ROW_META}>
        <div className={ALERT_ROW_APP}>
          <Skeleton shape="text" className="w-40" />
        </div>
        <div className={ALERT_ROW_TIME}>
          <Skeleton shape="text" className="inline-block w-16 align-middle" />
        </div>
      </div>
    </div>
  );
}

export function AlertFeedSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading alerts"
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-2">
        <TextLine type="text-title" width="w-24" />
        <TextLine type="text-body" width="w-56" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-full sm:w-64" />
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-7 w-24" />
        <div className="w-full sm:ml-auto sm:w-auto">
          <TextLine type="text-body" width="w-32" />
        </div>
      </div>
      <Card className="gap-0 py-0">
        <div className={ALERT_DAY_HEADING}>
          <Skeleton shape="text" className="w-16" />
        </div>
        <div className={ALERT_ROWS}>
          {SKELETON_SENTENCES.map((sentence, index) => (
            <RowSkeleton key={index} sentence={sentence} />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AlertFeedEmpty({
  filtered,
  searchedOnly,
  action,
}: {
  filtered: boolean;
  searchedOnly: number | null;
  action?: React.ReactNode;
}) {
  if (searchedOnly !== null) {
    return (
      <EmptyState
        className={EMPTY_STATE}
        title="No loaded events match"
        body={`Only the ${searchedOnly} loaded events were searched. Load more to search further back, or clear the filters.`}
        action={action}
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        className={EMPTY_STATE}
        title="No events match"
        body="Nothing recorded in the last 30 days matches the current app, event type and search."
        action={action}
      />
    );
  }
  return (
    <EmptyState
      className={EMPTY_STATE}
      title="Nothing recorded yet"
      body="The daily run records what it detects here, whether or not you have set up alerts. Come back after the next run, or set up delivery in Settings."
      action={
        <Button asChild variant="outline">
          <Link href="/settings">Open Settings</Link>
        </Button>
      }
    />
  );
}
