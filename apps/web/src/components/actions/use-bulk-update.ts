"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type {
  ActionBulkUpdateRequest,
  ActionBulkUpdateResult,
  ActionListResult,
} from "@asobeast/shared";
import { ApiError, bulkUpdateActions } from "@/lib/api";
import { actionKeys, invalidateActionMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { applyToList, listedStatuses } from "./optimistic-lists";

function successMessage(
  body: ActionBulkUpdateRequest,
  count: number,
  t: ReturnType<typeof useTranslations>,
): string {
  switch (body.status) {
    case "DONE":
      return t("toast.bulkDone", { count });
    case "SNOOZED":
      return t("toast.bulkSnoozed", { count });
    case "DISMISSED":
      return t("toast.bulkDismissed", { count });
    case "OPEN":
      return t("toast.bulkReopened", { count });
  }
}

function skippedNote(
  result: ActionBulkUpdateResult,
  t: ReturnType<typeof useTranslations>,
): string | undefined {
  const skipped = result.missing.length + result.conflicts.length;
  if (skipped === 0) return undefined;
  return skipped === 1
    ? t("toast.alreadyClosedOne")
    : t("toast.alreadyClosedMany", { count: skipped });
}

export function useBulkUpdate(appId?: string) {
  const t = useTranslations("actions");
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
        error instanceof ApiError ? error.message : t("toast.bulkUpdateFailed"),
      );
    },
    onSuccess: (result, body) => {
      if (body.revert) return;
      const changed = result.items.map((item) => item.id);
      toast.success(successMessage(body, changed.length, t), {
        description: skippedNote(result, t),
        action: {
          label: t("undo"),
          onClick: () => update({ ids: changed, status: "OPEN", revert: true }),
        },
      });
    },
    onSettled: () => invalidateActionMutation(queryClient, appId),
  });

  const update = useSingleFlight(mutation);

  return { update, isPending: mutation.isPending };
}
