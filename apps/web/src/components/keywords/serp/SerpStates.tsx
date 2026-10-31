import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { SERP_ROW_GRID } from "./SerpRow";

function Panel({ children }: { children: ReactNode }) {
  return (
    <p className="mx-4 mt-4 rounded-xl border border-dashed p-6 text-center text-body text-muted-foreground">
      {children}
    </p>
  );
}

export function SerpNeverChecked() {
  return (
    <Panel>
      Not checked yet. The search results appear after the next daily check.
    </Panel>
  );
}

export function SerpNothingCaptured({ date }: { date: string }) {
  return (
    <Panel>
      Nothing was captured on {formatDate(date)}. Pick a captured day.
    </Panel>
  );
}

export function SerpNoApps({ date }: { date: string }) {
  return (
    <Panel>
      The store showed no apps for this keyword on {formatDate(date)}.
    </Panel>
  );
}

export function SerpKeptShort() {
  return (
    <p className="px-4 pt-3 text-caption text-muted-foreground">
      Positions below the top 10 are not kept for this day.
    </p>
  );
}

export function SerpSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      <div className="mx-4 mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="flex flex-col gap-2 bg-card p-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
      <Skeleton className="mx-4 mt-6 mb-2 h-3 w-12" />
      {Array.from({ length: 10 }, (_, index) => (
        <div key={index} className={SERP_ROW_GRID}>
          <Skeleton className="col-start-1 row-start-1 ml-auto h-5 w-5" />
          <Skeleton className="col-start-2 row-start-1 size-10 rounded-xl" />
          <div className="col-start-3 row-start-1 flex flex-col gap-1.5 pt-0.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="col-start-4 row-start-1 h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
