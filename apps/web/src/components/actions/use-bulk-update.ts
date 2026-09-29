"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ActionBulkUpdateRequest,
  ActionBulkUpdateResult,
  ActionListResult,
} from "@asobeast/shared";
import { ApiError, bulkUpdateActions } from "@/lib/api";
import { pluralize } from "@/lib/format";
import { actionKeys, invalidateActionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { applyToList, listedStatuses } from "./optimistic-lists";

function successMessage(body: ActionBulkUpdateRequest, count: number): string {
  switch (body.status) {
    case "DONE":
      return `Marked ${count} done`;
    case "SNOOZED":
      return `Snoozed ${count}`;
    case "DISMISSED":
      return `Dismissed ${count}`;
    case "OPEN":
      return `Reopened ${count}`;
  }
}

function skippedNote(result: ActionBulkUpdateResult): string | undefined {
  const skipped = result.missing.length + result.conflicts.length;
  if (skipped === 0) return undefined;
  return skipped === 1
    ? "1 was already closed"
    : `${pluralize(skipped, "action")} were already closed`;
}

export function useBulkUpdate(appId?: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: bulkUpdateActions,
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: actionKeys.all });
      const previous = queryClient.getQueriesData<ActionListResult>({
        queryKey: actionKeys.lists,
      });
      const ids = new Set(body.ids);
      for (const [key, list] of previous) {
        if (!list) continue;
        queryClient.setQueryData(
          key,
          applyToList(list, listedStatuses(key), ids, body),
        );
      }
      return { previous };
    },
    onError: (error, _body, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not update the actions",
      );
    },
    onSuccess: (result, body) => {
      if (body.revert) return;
      const changed = result.items.map((item) => item.id);
      toast.success(successMessage(body, changed.length), {
        description: skippedNote(result),
        action: {
          label: "Undo",
          onClick: () =>
            mutation.mutate({ ids: changed, status: "OPEN", revert: true }),
        },
      });
    },
    onSettled: () => invalidateActionMutation(queryClient, appId),
  });

  return { update: useSingleFlight(mutation), isPending: mutation.isPending };
}
