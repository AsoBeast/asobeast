"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  ListOrdered,
  MoreHorizontal,
  Pause,
  Play,
  Shapes,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { isKeywordClass, type TrackedKeywordItem } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { scoreKeyword } from "@/lib/api";
import { invalidateKeywords } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  classChoice,
  DETECTED_CHOICE,
  keywordClassOptions,
} from "./keyword-class";
import { KeywordAnnotationsDialog } from "./KeywordAnnotationsDialog";
import { rememberSerpOpener } from "./serp/serp-opener";
import { StopTrackingDialog } from "./StopTrackingDialog";
import { useKeywordUpdate } from "./useKeywordUpdate";

export function KeywordRowActions({
  appId,
  keyword,
  marketTags,
  onOpenSerp,
}: {
  appId: string;
  keyword: TrackedKeywordItem;
  marketTags: () => string[];
  onOpenSerp: () => void;
}) {
  const t = useTranslations("keywords");
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const menu = useRef<HTMLButtonElement>(null);

  const update = useKeywordUpdate(appId, keyword);
  const checkedClass = classChoice(keyword);

  const scoreKey = ["keyword-score", keyword.keywordId];
  const scoring = useIsMutating({ mutationKey: scoreKey }) > 0;
  const score = useMutation({
    mutationKey: scoreKey,
    mutationFn: () => scoreKeyword(keyword.keywordId),
    onSuccess: () => {
      invalidateKeywords(queryClient, appId);
      toast.info(t("rowActions.scoreQueuedToast"), {
        description: t("rowActions.scoreQueued"),
      });
    },
    onError: () =>
      toast.error(t("rowActions.scoreFailed", { keyword: keyword.text })),
  });
  const scoreOnce = useSingleFlight(score);

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            ref={menu}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground data-[state=open]:text-foreground pointer-coarse:size-11"
            aria-label={t("rowActions.label", { keyword: keyword.text })}
            data-keyword-actions
            data-serp-keyword={keyword.keywordId}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-52">
          <DropdownMenuItem
            onSelect={() => {
              rememberSerpOpener(menu.current);
              onOpenSerp();
            }}
          >
            <ListOrdered />
            {t("rowActions.viewSerp")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setEditOpen(true)}>
            <Tag />
            {t("rowActions.editTags")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Shapes />
              {t("rowActions.type")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuRadioGroup
                value={checkedClass}
                onValueChange={(choice) => {
                  if (choice === checkedClass) return;
                  update.mutate({
                    keywordClass: isKeywordClass(choice) ? choice : null,
                  });
                }}
              >
                <DropdownMenuRadioItem value={DETECTED_CHOICE}>
                  <span>{t("rowActions.detected")}</span>
                </DropdownMenuRadioItem>
                {keywordClassOptions(t).map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                  >
                    <span>{option.label}</span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem disabled={scoring} onSelect={() => scoreOnce()}>
            <Sparkles />
            {t("rowActions.scoreNow")}
          </DropdownMenuItem>
          <DropdownMenuItem
            aria-disabled={update.isPending || undefined}
            className="aria-disabled:opacity-60"
            onSelect={(event) => {
              if (update.isPending) event.preventDefault();
              else update.mutate({ active: !keyword.active });
            }}
          >
            {keyword.active ? <Pause /> : <Play />}
            <span>
              {keyword.active ? t("rowActions.pause") : t("rowActions.resume")}
            </span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => setConfirmOpen(true)}
          >
            <Trash2 />
            {t("bulk.stop")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <KeywordAnnotationsDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appId={appId}
        keyword={keyword}
        marketTags={marketTags}
        returnFocus={menu}
      />

      <StopTrackingDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        appId={appId}
        keyword={keyword}
        returnFocus={menu}
      />
    </div>
  );
}
