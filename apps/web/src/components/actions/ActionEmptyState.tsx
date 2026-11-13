"use client";

import { ACTION_RULES } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";
import { GenerateNowButton } from "./GenerateNowButton";

const HOW_THE_QUEUE_IS_MADE = [
  `After each daily run, ${ACTION_RULES.length} fixed rules read your rankings, listing, reviews and store funnel.`,
  "Each finding becomes an action with its evidence, an impact figure and the steps to take.",
  "Mark it done and AsoBeast confirms the fix when the rule stops firing.",
];

const STEP_NUMBER =
  "numeric flex size-5 items-center justify-center rounded-md bg-muted text-tick font-medium text-muted-foreground";

function HowTheQueueIsMade() {
  return (
    <ol className="mx-auto flex max-w-[46ch] list-none flex-col gap-3 p-0 text-left text-dense text-muted-foreground">
      {HOW_THE_QUEUE_IS_MADE.map((step, index) => (
        <li
          key={step}
          className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2"
        >
          <span aria-hidden className={STEP_NUMBER}>
            {index + 1}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}

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
        className="py-12"
        title="No actions generated yet"
        action={
          <>
            <HowTheQueueIsMade />
            <GenerateNowButton generatedAt={generatedAt} />
          </>
        }
      />
    );
  }
  if (filtered) {
    return (
      <EmptyState
        className="py-12"
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
      className="py-12"
      title="Nothing to do right now"
      body={`Last generated ${formatDateTime(generatedAt)}.`}
      action={<GenerateNowButton generatedAt={generatedAt} />}
    />
  );
}
