import { PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const STEPS = Array.from({ length: 3 }, (_, index) => index);

function GoalSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {STEPS.map((index) => (
          <Skeleton key={index} className="h-[5.5rem] w-full" />
        ))}
      </div>
    </div>
  );
}

function StepSkeleton() {
  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <Skeleton className="h-5 w-36" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-5 w-full max-w-lg" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-36" />
      </CardContent>
      <CardFooter>
        <Skeleton className="h-4 w-64 max-w-full" />
      </CardFooter>
    </Card>
  );
}

export function SetupChecklistSkeleton() {
  return (
    <div role="status" aria-label="Loading setup" className="@container/setup">
      <div className="grid items-start gap-6 @4xl/setup:grid-cols-[minmax(0,45rem)_15rem] @4xl/setup:gap-x-8">
        <div className="flex min-w-0 max-w-[45rem] flex-col gap-6">
          <GoalSkeleton />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-full max-w-sm" />
            <Skeleton className="h-1 w-full rounded-full" />
          </div>
          {STEPS.map((index) => (
            <StepSkeleton key={index} />
          ))}
        </div>
        <div className="hidden flex-col gap-3 @4xl/setup:flex">
          {STEPS.map((index) => (
            <Skeleton key={index} className="h-6 w-full" />
          ))}
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </div>
  );
}
