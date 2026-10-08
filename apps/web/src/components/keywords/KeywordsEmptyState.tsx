"use client";

import { Plus, Tags, Upload } from "lucide-react";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry } from "@/lib/format";
import { AddKeywordsDialog } from "./AddKeywordsDialog";
import { ImportKeywordsDialog } from "./ImportKeywordsDialog";

export function KeywordsEmptyState({
  appId,
  store,
  country,
}: {
  appId: string;
  store: Store;
  country: string;
}) {
  return (
    <EmptyState
      icon={Tags}
      title={`No keywords tracked in ${formatCountry(country)} yet`}
      body="Add the phrases you want this app to rank for and AsoBeast starts capturing positions on the next daily run."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ImportKeywordsDialog appId={appId} store={store} country={country}>
            <Button variant="outline">
              <Upload />
              Import CSV
            </Button>
          </ImportKeywordsDialog>
          <AddKeywordsDialog appId={appId} store={store} country={country}>
            <Button>
              <Plus />
              Add keywords
            </Button>
          </AddKeywordsDialog>
        </div>
      }
    />
  );
}
