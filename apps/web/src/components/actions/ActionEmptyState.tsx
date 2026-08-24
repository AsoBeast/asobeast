"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CircleCheck, Filter, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { runActions } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { invalidateActionMutation } from "@/lib/queries";
import { queuedToast } from "@/lib/queued-toast";

export function ActionEmptyState({
  generatedAt,
  filtered,
  onClearFilters,
}: {
  generatedAt: string | null;
  filtered: boolean;
  onClearFilters: () => void;
}) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: runActions,
    onSuccess: () =>
      queuedToast(
        "action generation",
        "It reads stored data only, so it costs no store requests.",
      ),
    onError: () => toast.error("Could not queue generation"),
    onSettled: () => invalidateActionMutation(queryClient),
  });

  if (generatedAt === null) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No actions generated yet"
        body="Actions are generated after the daily pipeline completes. You can also run generation now — it reads stored data only and costs no store requests."
        action={
          <Button disabled={run.isPending} onClick={() => run.mutate()}>
            Generate now
          </Button>
        }
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
    />
  );
}
