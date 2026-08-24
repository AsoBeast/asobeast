"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { portfolioOptions } from "@/lib/queries";
import { ImportAppDialog } from "./ImportAppDialog";
import { PortfolioGrid } from "./PortfolioGrid";

export function AppsDashboard() {
  const { data } = useSuspenseQuery(portfolioOptions);

  if (data.apps.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <div className="flex flex-col gap-1">
          <p className="font-medium">No apps yet</p>
          <p className="max-w-sm text-body text-muted-foreground">
            Import an app from an App Store or Google Play URL to start tracking
            its keywords.
          </p>
        </div>
        <ImportAppDialog>
          <Button>Import your first app</Button>
        </ImportAppDialog>
      </div>
    );
  }

  return <PortfolioGrid apps={data.apps} groups={data.groups} />;
}
