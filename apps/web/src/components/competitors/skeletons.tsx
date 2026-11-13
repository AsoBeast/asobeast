import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROW = "flex h-11 items-center gap-3";

export function LedeSkeleton() {
  return <Skeleton className="h-5 w-96 max-w-full" />;
}

export function CompetitorListSkeleton() {
  return (
    <div className="flex flex-col px-(--card-spacing)">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className={ROW}>
          <Skeleton className="size-6 rounded-sm" />
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}

export function StandingSkeleton() {
  return (
    <div className="flex flex-col gap-1" aria-hidden>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="flex h-9 items-center gap-3">
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}

function TableRowsSkeleton({ rows }: { rows: number }) {
  return (
    <div className="flex flex-col">
      <div className="flex h-9 items-center">
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className={ROW}>
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
      <div className="flex h-8 items-end">
        <Skeleton className="h-3 w-48" />
      </div>
    </div>
  );
}

function ToolbarSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="ml-auto h-7 w-24" />
    </div>
  );
}

export function DiscoveryPanelSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <ToolbarSkeleton />
      <TableRowsSkeleton rows={3} />
    </div>
  );
}

function SectionSkeleton({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="min-h-[35px] content-center">
        <Skeleton className={title} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function TrackedCardSkeleton() {
  return (
    <SectionSkeleton title="h-5 w-56">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-full" />
        <CompetitorListSkeleton />
      </div>
    </SectionSkeleton>
  );
}

export function StandingCardSkeleton() {
  return (
    <SectionSkeleton title="h-5 w-36">
      <StandingSkeleton />
    </SectionSkeleton>
  );
}

export function GapCardSkeleton() {
  return (
    <SectionSkeleton title="h-5 w-52">
      <GapAnalysisSkeleton />
    </SectionSkeleton>
  );
}

export function DiscoveryCardSkeleton() {
  return (
    <SectionSkeleton title="h-5 w-48">
      <DiscoveryPanelSkeleton />
    </SectionSkeleton>
  );
}

export function ComparisonBodySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <ToolbarSkeleton />
      <TableRowsSkeleton rows={5} />
    </div>
  );
}

export function ComparisonMatrixSkeleton() {
  return (
    <SectionSkeleton title="h-5 w-72 max-w-full">
      <ComparisonBodySkeleton />
    </SectionSkeleton>
  );
}

export function GapAnalysisSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="h-9 w-96 max-w-full" />
      <ToolbarSkeleton />
      <TableRowsSkeleton rows={4} />
    </div>
  );
}
