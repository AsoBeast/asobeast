"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import type { ActionItem, ActionUpdateRequest } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ApiError, updateAction } from "@/lib/api";
import { actionKeys, invalidateActionMutation } from "@/lib/queries";
import { ActionSnoozeMenu } from "./ActionSnoozeMenu";

interface ListShape {
  items: ActionItem[];
  total: number;
  generatedAt: string | null;
}

function applyLocally(item: ActionItem, body: ActionUpdateRequest): ActionItem {
  return {
    ...item,
    status: body.status,
    snoozedUntil:
      body.status === "SNOOZED" ? (body.snoozedUntil ?? null) : null,
    note: body.note ?? item.note,
  };
}

export function ActionStateControls({ item }: { item: ActionItem }) {
  const queryClient = useQueryClient();
  const closed =
    item.status === "DONE" ||
    item.status === "DISMISSED" ||
    item.status === "RESOLVED";

  const mutation = useMutation({
    mutationFn: (body: ActionUpdateRequest) => updateAction(item.id, body),
    onMutate: async (body) => {
      await queryClient.cancelQueries({ queryKey: actionKeys.all });
      const previous = queryClient.getQueriesData<ListShape>({
        queryKey: actionKeys.all,
      });
      queryClient.setQueriesData<ListShape>(
        { queryKey: actionKeys.all },
        (list) =>
          list && Array.isArray(list.items)
            ? {
                ...list,
                items: list.items.map((row) =>
                  row.id === item.id ? applyLocally(row, body) : row,
                ),
              }
            : list,
      );
      return { previous };
    },
    onError: (error, _body, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(
        error instanceof ApiError
          ? error.message
          : "Could not update the action",
      );
    },
    onSuccess: (_updated, body) => {
      if (body.status === "OPEN") {
        toast.success("Action reopened");
        return;
      }
      if (body.status === "SNOOZED") return;
      toast.success(body.status === "DONE" ? "Marked done" : "Dismissed", {
        action: {
          label: "Undo",
          onClick: () => mutation.mutate({ status: "OPEN" }),
        },
      });
    },
    onSettled: () => invalidateActionMutation(queryClient, item.scope.appId),
  });

  if (closed) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ status: "OPEN" })}
      >
        <RotateCcw aria-hidden className="size-4" />
        Reopen
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ status: "DONE" })}
      >
        <Check aria-hidden className="size-4" />
        Done
      </Button>
      <ActionSnoozeMenu
        status={item.status}
        snoozedUntil={item.snoozedUntil}
        disabled={mutation.isPending}
        onSnooze={(snoozedUntil) =>
          mutation.mutate({ status: "SNOOZED", snoozedUntil })
        }
        onWake={() => mutation.mutate({ status: "OPEN" })}
      />
      <Button
        variant="ghost"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ status: "DISMISSED" })}
      >
        <X aria-hidden className="size-4" />
        Dismiss
      </Button>
    </div>
  );
}
