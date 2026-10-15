"use client";

import { Suspense, useState } from "react";
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
  const { data } = useSuspenseQuery(replyGuidelinesOptions(id));
  const [text, setText] = useState(data.guidelines);
  const limit = textLimit(text, REVIEW_REPLY_GUIDELINES_MAX);
  const queryClient = useQueryClient();
  const saving = useMutation({
    mutationFn: () => putReviewReplyGuidelines(id, { guidelines: text }),
    onSuccess: (saved) => {
      queryClient.setQueryData(appKeys.replyGuidelines(id), saved);
      toast.success("Reply guidelines saved");
      onSaved();
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Could not save the reply guidelines",
      ),
  });
  const saveOnce = useSingleFlight(saving);

  return (
    <>
      <DialogBody className="flex flex-col gap-1">
        <Textarea
          aria-label="Reply guidelines"
          value={text}
          aria-invalid={limit.over > 0 || undefined}
          onChange={(event) => setText(event.target.value)}
          placeholder="Sign as the Tomato team. Support: help@example.com. Never promise a release date."
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
          <Button variant="outline">Cancel</Button>
        </DialogClose>
        <Button
          disabled={saving.isPending || limit.over > 0}
          onClick={() => saveOnce()}
        >
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

export function ReplyGuidelinesDialog({ id }: { id: string }) {
  const { data: status } = useQuery(aiStatusOptions);
  const [open, setOpen] = useState(false);
  if (!status?.configured) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reply guidelines
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply guidelines</DialogTitle>
          <DialogDescription>
            Every AI draft for this app follows these lines: who signs, the
            support address, what never to promise.
          </DialogDescription>
        </DialogHeader>
        <Suspense fallback={<Skeleton className="h-32 w-full" />}>
          <GuidelinesForm id={id} onSaved={() => setOpen(false)} />
        </Suspense>
      </DialogContent>
    </Dialog>
  );
}
