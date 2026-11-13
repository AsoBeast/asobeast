"use client";

import { ACTION_RULES } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { GenerateNowButton } from "./GenerateNowButton";
import { NumberedSteps } from "./NumberedSteps";

const HOW_THE_QUEUE_IS_MADE = [
  `After each daily run, ${ACTION_RULES.length} fixed rules read your rankings, listing, reviews and store funnel.`,
  "Each finding becomes an action with its evidence, an impact figure and the steps to take.",
  "Mark it done and AsoBeast confirms the fix when the rule stops firing.",
];

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
        className="py-8"
        title="No actions generated yet"
        action={
          <>
            <NumberedSteps
              steps={HOW_THE_QUEUE_IS_MADE}
              className="mx-auto max-w-[46ch] gap-3 text-left text-muted-foreground"
            />
            <GenerateNowButton generatedAt={generatedAt} />
          </>
        }
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        className="py-8"
        title="No actions match these filters"
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
      className="py-8"
      title="Nothing to do right now"
      body={`Last generated ${formatDateTime(generatedAt)}.`}
      action={<GenerateNowButton generatedAt={generatedAt} />}
    />
  );
}
