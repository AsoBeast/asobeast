"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type {
  WorkspaceChecklist,
  WorkspaceChecklistUpdateRequest,
} from "@asobeast/shared";
import { updateWorkspaceChecklist } from "@/lib/api";
import {
  invalidateWorkspaceChecklist,
  workspaceChecklistKey,
} from "@/lib/queries";
import { applyChecklistPatch } from "./checklist-patch";

interface ChecklistSave {
  patch: WorkspaceChecklistUpdateRequest;
  previous: WorkspaceChecklist | undefined;
  failure: string;
}

export interface ChecklistSaveOptions {
  failure: string;
  optimistic?: boolean;
  onSaved?: (saved: WorkspaceChecklist) => void;
}

export function useChecklistSave() {
  const client = useQueryClient();
  const isLastSave = () =>
    client.isMutating({ mutationKey: workspaceChecklistKey }) === 1;
  const mutation = useMutation({
    mutationKey: workspaceChecklistKey,
    scope: { id: workspaceChecklistKey.join(":") },
    mutationFn: ({ patch }: ChecklistSave) => updateWorkspaceChecklist(patch),
    onSuccess: (saved) => {
      if (isLastSave()) client.setQueryData(workspaceChecklistKey, saved);
    },
    onError: (_error, { previous, failure }) => {
      if (previous && isLastSave()) {
        client.setQueryData(workspaceChecklistKey, previous);
      }
      toast.error(failure);
    },
    onSettled: () =>
      isLastSave() ? invalidateWorkspaceChecklist(client) : undefined,
  });

  const save = (
    patch: WorkspaceChecklistUpdateRequest,
    { failure, optimistic = false, onSaved }: ChecklistSaveOptions,
  ) => {
    const current = client.getQueryData<WorkspaceChecklist>(
      workspaceChecklistKey,
    );
    if (optimistic && current) {
      void client.cancelQueries({ queryKey: workspaceChecklistKey });
      client.setQueryData(
        workspaceChecklistKey,
        applyChecklistPatch(current, patch, new Date()),
      );
    }
    mutation.mutate(
      { patch, previous: optimistic ? current : undefined, failure },
      { onSuccess: onSaved },
    );
  };

  return { save, pending: mutation.isPending };
}
