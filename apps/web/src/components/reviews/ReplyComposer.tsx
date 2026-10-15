"use client";

import { useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  countChars,
  REVIEW_REPLY_LIMITS,
  type ReviewItem,
  type Store,
} from "@asobeast/shared";
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
import { DeveloperReply } from "./ReviewCard";
import { consoleHref, consoleLabel } from "./store-console";
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
  const limit = REVIEW_REPLY_LIMITS[store];
  const length = countChars(text);
  const over = length > limit;
  const trimmed = text.trim();
  const unsaved = trimmed !== "" && trimmed !== saved;
  const marked = Boolean(review.reply?.repliedAt);
  const console = consoleLabel(store);

  const saveIfChanged = () =>
    unsaved && !over ? save(trimmed) : Promise.resolve(null);

  const copy = async () => {
    await saveIfChanged().catch(() => null);
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success("Reply copied");
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
        <div className="flex flex-col gap-1">
          <DeveloperReply review={review} />
          <p className="text-caption text-muted-foreground">
            Google Play already shows a reply; a new text here replaces it when
            you post it in the console.
          </p>
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <Textarea
          aria-label="Reply text"
          aria-invalid={over || undefined}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={() => void saveIfChanged().catch(() => null)}
          placeholder="Write the reply the store will show under this review"
          className="min-h-24 bg-card"
        />
        <p
          aria-live="polite"
          className={cn(
            "text-caption numeric",
            over ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {length} / {limit}
          {over
            ? ` · ${storeLabel(store)} allows at most ${limit} characters`
            : null}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          disabled={over || trimmed === ""}
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
            Open {console}
          </a>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={over || pending}
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
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={pending || (!review.reply && text === "")}
            >
              Discard
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this reply?</AlertDialogTitle>
              <AlertDialogDescription>
                The text and the replied mark kept for this review are removed.
                A reply already posted in {console} stays there.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep it</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() => {
                  setText("");
                  void discard().catch(() => null);
                }}
              >
                Discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        AsoBeast never writes to the store. Paste the reply in {console}.
      </p>
    </section>
  );
}
