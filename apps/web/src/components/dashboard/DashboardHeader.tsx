import type { ReactNode } from "react";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { Button } from "@/components/ui/button";

export function DashboardHeader({
  lede,
  children,
}: {
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-title text-balance">Dashboard</h1>
        <ImportAppDialog>
          <Button variant="outline">Import app</Button>
        </ImportAppDialog>
      </div>
      {lede}
      {children}
    </div>
  );
}
