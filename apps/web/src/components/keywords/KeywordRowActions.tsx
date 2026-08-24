"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Sparkles, Trash2 } from "lucide-react";
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
import { removeKeyword, scoreKeyword, updateKeyword } from "@/lib/api";
import { queuedToast } from "@/lib/queued-toast";
import {
  appKeys,
  invalidateKeywordMutation,
  invalidateKeywords,
} from "@/lib/queries";

export function KeywordRowActions({
  appId,
  keyword,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
}) {
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const toggle = useMutation({
    mutationFn: (active: boolean) =>
      updateKeyword(appId, keyword.keywordId, { active }),
    onMutate: async (active) => {
      await queryClient.cancelQueries({
        queryKey: appKeys.keywordsRoot(appId),
      });
      const previous = queryClient.getQueriesData<TrackedKeywordItem[]>({
        queryKey: appKeys.keywordsRoot(appId),
      });
      queryClient.setQueriesData<TrackedKeywordItem[]>(
        { queryKey: appKeys.keywordsRoot(appId) },
        (rows) =>
          rows?.map((row) =>
            row.keywordId === keyword.keywordId ? { ...row, active } : row,
          ),
      );
      return { previous };
    },
    onError: (_error, _active, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toast.error(`Could not update ${keyword.text}`);
    },
    onSettled: () => invalidateKeywordMutation(queryClient, appId),
  });

  const score = useMutation({
    mutationFn: () => scoreKeyword(keyword.keywordId),
    onSuccess: () => {
      invalidateKeywords(queryClient, appId);
      queuedToast(
        "scoring",
        "Traffic, difficulty and opportunity land after the run.",
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

  return (
    <div className="flex items-center justify-end gap-2">
      <Switch
        checked={keyword.active}
        disabled={toggle.isPending}
        onCheckedChange={(next) => toggle.mutate(next)}
        aria-label={keyword.active ? "Pause keyword" : "Resume keyword"}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Keyword actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
                remove.mutate();
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
