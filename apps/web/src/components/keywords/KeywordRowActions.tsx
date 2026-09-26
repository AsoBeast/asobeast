"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Sparkles, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { TrackedKeywordItem } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { removeKeyword, scoreKeyword } from "@/lib/api";
import { queuedToast } from "@/lib/queued-toast";
import { invalidateKeywordMutation, invalidateKeywords } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { KeywordAnnotationsDialog } from "./KeywordAnnotationsDialog";
import { useKeywordUpdate } from "./useKeywordUpdate";

export function KeywordRowActions({
  appId,
  keyword,
  marketTags,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  marketTags: () => string[];
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const toggle = useKeywordUpdate(appId, keyword);

  const score = useMutation({
    mutationFn: () => scoreKeyword(keyword.keywordId),
    onSuccess: () => {
      invalidateKeywords(queryClient, appId);
      queuedToast(
        "scoring",
        "Popularity, difficulty and opportunity land after the run.",
      );
    },
    onError: () => toast.error(`Could not queue scoring for ${keyword.text}`),
  });

  const remove = useMutation({
    mutationFn: () => removeKeyword(appId, keyword.keywordId),
    onSuccess: () => {
      invalidateKeywordMutation(queryClient, appId);
      setConfirmOpen(false);
      toast.success(`Stopped tracking ${keyword.text}`);
    },
    onError: () => toast.error(`Could not stop tracking ${keyword.text}`),
  });
  const removeOnce = useSingleFlight(remove);

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch
        checked={keyword.active}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate({ active: next })}
        aria-label={keyword.active ? "Pause keyword" : "Resume keyword"}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label="Keyword actions"
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Tag />
            Edit tags and note
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={score.isPending}
            onSelect={() => score.mutate()}
          >
            <Sparkles />
            Score now
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 />
            Stop tracking
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <KeywordAnnotationsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appId={appId}
        keyword={keyword}
        marketTags={marketTags}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop tracking {keyword.text}?</AlertDialogTitle>
            <AlertDialogDescription>
              Ranking history for this keyword stops accruing. You can add it
              again later, but the gap in history will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={(event) => {
                event.preventDefault();
                removeOnce();
              }}
            >
              {remove.isPending ? "Removing…" : "Stop tracking"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
