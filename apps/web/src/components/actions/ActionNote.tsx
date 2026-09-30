"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ActionItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, updateAction } from "@/lib/api";
import { invalidateActionMutation } from "@/lib/queries";
import { limitCounterText, textLimit } from "@/lib/text-limit";
import { cn } from "@/lib/utils";
import { ACTION_NOTE_MAX_LENGTH, noteRequest } from "./note-request";

export function ActionNote({ item }: { item: ActionItem }) {
  const queryClient = useQueryClient();
  const saved = item.note ?? "";
  const [draft, setDraft] = useState(saved);
  const request = noteRequest(item, draft.trim());
  const noteLimit = textLimit(draft.trim(), ACTION_NOTE_MAX_LENGTH);

  const save = useMutation({
    mutationFn: () => {
      if (!request) throw new Error("This action cannot take a note");
      return updateAction(item.id, request);
    },
    onSuccess: () => toast.success("Note saved"),
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the note",
      ),
    onSettled: () => invalidateActionMutation(queryClient, item.scope.appId),
  });

  if (!request) {
    return (
      <div className="flex flex-col gap-2">
        {saved ? (
          <p className="text-body whitespace-pre-line">{saved}</p>
        ) : null}
        <p className="text-caption text-muted-foreground">
          Reopen this action to edit its note.
        </p>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <Textarea
        aria-label="Note for this action"
        aria-invalid={noteLimit.over > 0}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="flex items-center justify-between gap-2">
        <span
          aria-live="polite"
          className={cn(
            "numeric font-mono text-caption",
            noteLimit.over > 0
              ? "font-medium text-destructive"
              : "text-muted-foreground",
          )}
        >
          {limitCounterText(noteLimit, ACTION_NOTE_MAX_LENGTH)}
        </span>
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={
            draft.trim() === saved || save.isPending || noteLimit.over > 0
          }
        >
          Save note
        </Button>
      </div>
    </form>
  );
}
