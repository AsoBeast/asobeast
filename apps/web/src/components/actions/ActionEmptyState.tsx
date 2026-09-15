"use client";

import { CircleCheck, Filter, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { GenerateNowButton } from "./GenerateNowButton";

export function ActionEmptyState({
  generatedAt,
  filtered,
  onClearFilters,
}: {
  generatedAt: string | null;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  if (generatedAt === null) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No actions generated yet"
        body="Actions are generated after the daily pipeline completes. You can also run generation now — it reads stored data only and costs no store requests."
        action={<GenerateNowButton generatedAt={generatedAt} />}
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        icon={Filter}
        title="No actions match these filters"
        body="Nothing in this workspace matches the current status, priority and rule filters."
        action={
          <Button variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={CircleCheck}
      title="Nothing to do right now"
      body={`Last generated ${formatDateTime(generatedAt)}.`}
      action={<GenerateNowButton generatedAt={generatedAt} />}
    />
  );
}
