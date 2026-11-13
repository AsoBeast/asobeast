import { Suspense, type ReactNode } from "react";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <PageHeader
      title="Dashboard"
      controls={
        <>
          <Suspense fallback={<Skeleton className="h-[34px] w-36" />}>
            <DashboardRange />
          </Suspense>
          <ImportAppDialog>
            <Button>Import app</Button>
          </ImportAppDialog>
        </>
      }
    >
      {lede}
      {children}
    </PageHeader>
  );
}
