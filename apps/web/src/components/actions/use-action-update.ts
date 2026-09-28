"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  ActionItem,
  ActionListResult,
  ActionUpdateRequest,
} from "@asobeast/shared";
import { ApiError, updateAction } from "@/lib/api";
import { actionKeys, invalidateActionMutation } from "@/lib/queries";
import { applyToList, listedStatuses } from "./optimistic-lists";
import { focusAfterRemoval } from "./row-focus";

function undoRequest(before: ActionItem): ActionUpdateRequest {
  if (before.status === "SNOOZED" && before.snoozedUntil) {
    return {
      status: "SNOOZED",
      snoozedUntil: before.snoozedUntil,
      revert: true,
    };
  }
  return { status: "OPEN", revert: true };
}

export function useActionUpdate(
  item: ActionItem,
  { moveFocus = false }: { moveFocus?: boolean } = {},
) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (body: ActionUpdateRequest) => updateAction(item.id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: actionKeys.all });
      const previous = queryClient.getQueriesData<ActionListResult>({
        queryKey: actionKeys.lists,
      });
      if (
        moveFocus &&
        (body.status === "DONE" || body.status === "DISMISSED")
      ) {
        focusAfterRemoval(item.id);
      }
      for (const [key, list] of previous) {
        if (!list) continue;
        queryClient.setQueryData(
          key,
          applyToList(list, listedStatuses(key), new Set([item.id]), body),
        );
      }
      return { previous, before: item };
    },
    onError: (error, _body, context) => {
      for (const [key, data] of context?.previous ?? []) {
        queryClient.setQueryData(key, data);
      }
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not update the action",
      );
    },
    onSuccess: (_updated, body, context) => {
      if (body.revert) return;
      if (body.status === "OPEN") {
        toast.success("Action reopened");
        return;
      }
      if (body.status === "SNOOZED") return;
      toast.success(body.status === "DONE" ? "Marked done" : "Dismissed", {
        action: {
          label: "Undo",
          onClick: () => mutation.mutate(undoRequest(context.before)),
        },
      });
    },
    onSettled: () => invalidateActionMutation(queryClient, item.scope.appId),
  });

  return mutation;
}
