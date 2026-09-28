import type { ReactNode } from "react";
import { ImportAppDialog } from "@/components/apps/ImportAppDialog";
import { Button } from "@/components/ui/button";

export function DashboardHeader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-display tracking-tight text-balance">Dashboard</h1>
        <ImportAppDialog>
          <Button>Import app</Button>
        </ImportAppDialog>
      </div>
      {children}
    </div>
  );
}
