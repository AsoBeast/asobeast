"use client";

import { Suspense, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { REVIEW_REPLY_GUIDELINES_MAX } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ApiError, putReviewReplyGuidelines } from "@/lib/api";
import {
  aiStatusOptions,
  appKeys,
  replyGuidelinesOptions,
} from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { limitCounterText, textLimit } from "@/lib/text-limit";

function GuidelinesForm({ id, onSaved }: { id: string; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const common = useTranslations("common");
  const { data } = useSuspenseQuery(replyGuidelinesOptions(id));
  const [text, setText] = useState(data.guidelines);
  const limit = textLimit(text, REVIEW_REPLY_GUIDELINES_MAX);
  const queryClient = useQueryClient();
  const saving = useMutation({
    mutationFn: () => putReviewReplyGuidelines(id, { guidelines: text }),
    onSuccess: (saved) => {
      queryClient.setQueryData(appKeys.replyGuidelines(id), saved);
      toast.success(t("guidelines.saved"));
      onSaved();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : t("guidelines.saveFailed"),
      ),
  });
  const saveOnce = useSingleFlight(saving);

  return (
    <>
      <DialogBody className="flex flex-col gap-1">
        <Textarea
          aria-label={t("guidelines.title")}
          value={text}
          aria-invalid={limit.over > 0 || undefined}
          onChange={(event) => setText(event.target.value)}
          placeholder={t("guidelines.placeholder")}
          className="min-h-32"
        />
        <p
          aria-live="polite"
          className={cn(
            "text-caption numeric",
            limit.over > 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {limitCounterText(limit, REVIEW_REPLY_GUIDELINES_MAX)}
        </p>
      </DialogBody>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">{common("cancel")}</Button>
        </DialogClose>
        <Button
          disabled={saving.isPending || limit.over > 0}
          onClick={() => saveOnce()}
        >
          {t("guidelines.save")}
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReplyGuidelinesDialog({ id }: { id: string }) {
  const t = useTranslations("reviews");
  const { data: status } = useQuery(aiStatusOptions);
  const [open, setOpen] = useState(false);
  if (!status?.configured) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          {t("guidelines.title")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("guidelines.title")}</DialogTitle>
          <DialogDescription>{t("guidelines.description")}</DialogDescription>
        </DialogHeader>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <GuidelinesForm id={id} onSaved={() => setOpen(false)} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
