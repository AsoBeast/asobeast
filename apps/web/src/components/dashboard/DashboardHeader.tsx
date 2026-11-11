import { Suspense, type ReactNode } from "react";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardRange } from "./DashboardRange";

export function DashboardHeader({
  lede,
  children,
}: {
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h1 className="text-title text-balance">Dashboard</h1>
        <div className="flex items-center gap-2">
          <Suspense fallback={<Skeleton className="h-[34px] w-36" />}>
            <DashboardRange />
          </Suspense>
          <ImportAppDialog>
            <Button>Import app</Button>
          </ImportAppDialog>
        </div>
      </div>
      {lede}
      {children}
    </div>
  );
}
