"use client";

import { useId, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { ReviewItem, Store } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { storeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReplyDraftControls } from "./ReplyDraftControls";
import { measureReply, type ReplyMeasure } from "./reply-text";
import { consoleHref, consoleLabel } from "./store-console";
import { useReplyDraft } from "./use-reply-draft";
import { useReviewReply } from "./use-review-reply";

export interface ReplyComposerProps {
  appId: string;
  review: ReviewItem;
  store: Store;
  storeAppId: string;
  onClose: () => void;
}

function useReplyText(saved: string) {
  const [text, setText] = useState(saved);
  const [baseline, setBaseline] = useState(saved);
  if (saved !== baseline) {
    setBaseline(saved);
    if (text === baseline) setText(saved);
  }
  return [text, setText] as const;
}

function ReplyCounter({
  id,
  measure,
  store,
}: {
  id: string;
  measure: ReplyMeasure;
  store: Store;
}) {
  const { length, limit, over } = measure;
  return (
    <p
      id={id}
      className={cn(
        "text-caption numeric",
        over ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {length} / {limit}
      <span aria-live="polite">
        {over
          ? ` · ${storeLabel(store)} allows at most ${limit} characters`
          : null}
      </span>
    </p>
  );
}

function ClearedReplyHint({
  text,
  saved,
  drafting,
}: {
  text: string;
  saved: string;
  drafting: boolean;
}) {
  const kept = text === "" && saved !== "" && !drafting;
  return (
    <p
      aria-live="polite"
      className="text-caption text-muted-foreground empty:hidden"
    >
      {kept
        ? "Emptying the field keeps the saved reply. Press Discard to remove it."
        : null}
    </p>
  );
}

function DiscardReplyButton({
  consoleName,
  disabled,
  onDiscard,
}: {
  consoleName: string;
  disabled: boolean;
  onDiscard: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          Discard
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard this reply?</AlertDialogTitle>
          <AlertDialogDescription>
            The text and the replied mark kept for this review are removed. A
            reply already posted in {consoleName} stays there.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onDiscard}>
            Discard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ReplyComposer({
  appId,
  review,
  store,
  storeAppId,
  onClose,
}: ReplyComposerProps) {
  const saved = review.reply?.text ?? "";
  const [text, setText] = useReplyText(saved);
  const { save, mark, discard, pending } = useReviewReply(appId, review);
  const draft = useReplyDraft(appId, review, setText);
  const busy = pending || draft.drafting;
  const counterId = useId();
  const measure = measureReply(text, store);
  const { trimmed, over } = measure;
  const unsaved = trimmed !== "" && trimmed !== saved;
  const marked = Boolean(review.reply?.repliedAt);
  const consoleName = consoleLabel(store);

  const saveIfChanged = () =>
    unsaved && !over && !draft.drafting ? save(trimmed) : Promise.resolve(null);

  const copy = async () => {
    const copied = navigator.clipboard
      ? navigator.clipboard.writeText(trimmed)
      : Promise.reject(new Error("clipboard unavailable"));
    void saveIfChanged().catch(() => null);
    try {
      await copied;
      toast.success(`Reply copied. Paste it in ${consoleName}.`);
    } catch {
      toast.error("Couldn't copy — select and copy it manually");
    }
  };

  return (
    <section
      aria-label="Reply to review"
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3"
    >
      {review.replyText ? (
        <p className="text-caption text-muted-foreground">
          Google Play already shows a reply; a new text here replaces it when
          you post it in the console.
        </p>
      ) : null}
      <ReplyDraftControls
        review={review}
        store={store}
        busy={pending}
        draft={draft}
        text={text}
      />
      <div className="flex flex-col gap-1">
        <Textarea
          autoFocus
          aria-label="Reply text"
          dir="auto"
          aria-describedby={counterId}
          aria-invalid={over || undefined}
          aria-busy={draft.drafting || undefined}
          readOnly={draft.drafting}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => void saveIfChanged().catch(() => null)}
          placeholder={
            draft.drafting
              ? "Drafting a reply…"
              : "Write the reply the store will show under this review"
          }
          className="min-h-24 bg-card"
        />
        <ReplyCounter id={counterId} measure={measure} store={store} />
        <ClearedReplyHint
          text={trimmed}
          saved={saved}
          drafting={draft.drafting}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={over || trimmed === "" || draft.drafting}
          onClick={() => void copy()}
        >
          <Copy />
          Copy
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a
            href={consoleHref(store, storeAppId)}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink />
            Open {consoleName}
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={(over && !marked) || busy}
          onClick={() =>
            void mark(
              marked
                ? { replied: false }
                : { ...(unsaved ? { text: trimmed } : {}), replied: true },
            ).catch(() => null)
          }
        >
          {marked ? "Undo" : "Mark as replied"}
        </Button>
        <DiscardReplyButton
          consoleName={consoleName}
          disabled={busy || (!review.reply && text === "")}
          onDiscard={() =>
            void discard()
              .then(() => setText(""))
              .catch(() => null)
          }
        />
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        AsoBeast never writes to the store. Paste the reply in {consoleName}.
      </p>
    </section>
  );
}
