import Link from "next/link";
import { BellOff, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const SKELETON_ROWS = 8;

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

export function AlertFeedSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading alerts"
      className="flex flex-col gap-6"
    >
      <TextLine type="text-display" width="w-24" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-full max-w-xl" />
        <TextLine type="text-body" width="w-32" />
      </div>
      <div className="flex flex-col gap-2">
        <TextLine type="text-label" width="w-24" />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton
            key={index}
            data-feed-row
            className="h-18 w-full rounded-lg"
          />
        ))}
      </div>
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
        icon={Filter}
        title="No loaded events match"
        body={`Only the ${searchedOnly} loaded events were searched. Load more to search further back, or clear the filters.`}
        action={action}
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        icon={Filter}
        title="No events match"
        body="Nothing recorded in the last 30 days matches the current app, event type and search."
        action={action}
      />
    );
  }
  return (
    <EmptyState
      icon={BellOff}
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
