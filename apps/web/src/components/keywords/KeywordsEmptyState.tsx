"use client";

import { Plus, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry } from "@/lib/format";
import { AddKeywordsDialog } from "./AddKeywordsDialog";

export function KeywordsEmptyState({
  appId,
  country,
}: {
  appId: string;
  country: string;
}) {
  return (
    <EmptyState
      icon={Tags}
      title={`No keywords tracked in ${formatCountry(country)} yet`}
      body="Add the phrases you want this app to rank for and asobeast starts capturing positions on the next daily run."
      action={
        <AddKeywordsDialog appId={appId} country={country}>
          <Button>
            <Plus />
            Add keywords
          </Button>
        </AddKeywordsDialog>
      }
    />
  );
}
