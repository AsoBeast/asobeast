import Link from "next/link";
import { BellOff, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

const SKELETON_ROWS = 8;

export function AlertFeedSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading alerts"
      className="flex flex-col gap-6"
    >
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-9 w-full max-w-xl" />
      <div className="flex flex-col gap-2">
        <Skeleton shape="text" className="w-24" />
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function AlertFeedEmpty({
  filtered,
  action,
}: {
  filtered: boolean;
  action?: React.ReactNode;
}) {
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
