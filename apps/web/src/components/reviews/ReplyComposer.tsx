"use client";

import { useId, useRef, useState, type RefObject } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type {
  ReviewItem,
  ReviewReplyPatchRequest,
  Store,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { storeLabel } from "@/lib/format";
import { useSharedFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";
import { PostReplyDialog } from "./PostReplyDialog";
import { ReplyConfirmDialog } from "./ReplyConfirmDialog";
import { ReplyDraftControls } from "./ReplyDraftControls";
import { ReplyFooter, StoreReplyNotice } from "./ReplyStoreNotes";
import { WithdrawReplyButton } from "./WithdrawReplyButton";
import { measureReply, type ReplyMeasure } from "./reply-text";
import { consoleHref, consoleLabel } from "./store-console";
import {
  composerActions,
  discardNotice,
  markLabel,
} from "./store-reply-access";
import { useReplyDraft } from "./use-reply-draft";
import { useReviewReply } from "./use-review-reply";
import { useStorePosting } from "./use-store-posting";
import { useStoreReplyAccess } from "./use-store-reply-access";

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
      <span>{`${length} / ${limit}`}</span>
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
  notice,
  disabled,
  textRef,
  onDiscard,
}: {
  notice: string;
  disabled: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onDiscard: () => void;
}) {
  return (
    <ReplyConfirmDialog
      trigger={
        <Button variant="outline" size="sm" disabled={disabled}>
          Discard
        </Button>
      }
      title="Discard this reply?"
      description={`The text and the replied mark kept for this review are removed. ${notice}`}
      cancelLabel="Keep it"
      actionLabel="Discard"
      destructive
      textRef={textRef}
      onConfirm={onDiscard}
    />
  );
}

function ReplyTextField({
  textRef,
  text,
  saved,
  measure,
  store,
  drafting,
  onChange,
  onBlur,
}: {
  textRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  saved: string;
  measure: ReplyMeasure;
  store: Store;
  drafting: boolean;
  onChange: (text: string) => void;
  onBlur: () => void;
}) {
  const counterId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        ref={textRef}
        autoFocus
        aria-label="Reply text"
        dir="auto"
        aria-describedby={counterId}
        aria-invalid={measure.over || undefined}
        aria-busy={drafting || undefined}
        readOnly={drafting}
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={
          drafting
            ? "Drafting a reply…"
            : "Write the reply the store will show under this review"
        }
        className="min-h-24 bg-card"
      />
      <ReplyCounter id={counterId} measure={measure} store={store} />
      <ClearedReplyHint
        text={measure.trimmed}
        saved={saved}
        drafting={drafting}
      />
    </div>
  );
}

const markBody = (
  marked: boolean,
  unsaved: boolean,
  trimmed: string,
): ReviewReplyPatchRequest =>
  marked
    ? { replied: false }
    : { ...(unsaved ? { text: trimmed } : {}), replied: true };

export function ReplyComposer({
  appId,
  review,
  store,
  storeAppId,
  onClose,
}: ReplyComposerProps) {
  const saved = review.reply?.text ?? "";
  const [text, setText] = useReplyText(saved);
  const { save, mark, discard, post, withdraw, pending } = useReviewReply(
    appId,
    review,
  );
  const draft = useReplyDraft(appId, review, setText);
  const access = useStoreReplyAccess(store);
  const busy = pending || draft.drafting;
  const markOnce = useSharedFlight(mark);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const measure = measureReply(text, store);
  const { trimmed, over } = measure;
  const unsaved = trimmed !== "" && trimmed !== saved;
  const marked = Boolean(review.reply?.repliedAt);
  const consoleName = consoleLabel(store);
  const posted = Boolean(review.reply?.post);
  const ready = access.kind === "ready";
  const actions = composerActions(access, store, review.reply, trimmed);
  const unusable = over || trimmed === "" || draft.drafting;

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

  const { publish, retract } = useStorePosting({
    store,
    saveIfChanged,
    post,
    withdraw,
  });

  return (
    <section
      aria-label="Reply to review"
      className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3"
    >
      <StoreReplyNotice review={review} store={store} />
      <ReplyDraftControls
        review={review}
        store={store}
        busy={pending}
        draft={draft}
        text={text}
      />
      <ReplyTextField
        textRef={textRef}
        text={text}
        saved={saved}
        measure={measure}
        store={store}
        drafting={draft.drafting}
        onChange={setText}
        onBlur={() => void saveIfChanged().catch(() => null)}
      />
      <div className="flex flex-wrap items-center gap-2">
        {actions.post ? (
          <PostReplyDialog
            store={store}
            text={trimmed}
            label={actions.post}
            disabled={unusable}
            busy={busy}
            textRef={textRef}
            onPost={publish}
          />
        ) : null}
        <Button
          size="sm"
          variant={ready ? "outline" : "default"}
          disabled={unusable}
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
        {actions.mark ? (
          <Button
            variant={ready ? "secondary" : "outline"}
            size="sm"
            disabled={over && !marked}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (busy) return;
              void markOnce(markBody(marked, unsaved, trimmed)).catch(
                () => null,
              );
            }}
          >
            {markLabel(marked, ready)}
          </Button>
        ) : null}
        {actions.withdraw ? (
          <WithdrawReplyButton
            busy={busy}
            textRef={textRef}
            onWithdraw={retract}
          />
        ) : null}
        {actions.discard ? (
          <DiscardReplyButton
            notice={discardNotice(store, review.reply)}
            disabled={busy || (!review.reply && text === "")}
            textRef={textRef}
            onDiscard={() =>
              void discard()
                .then(() => setText(""))
                .catch(() => null)
            }
          />
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </div>
      <ReplyFooter access={access} store={store} posted={posted} />
    </section>
  );
}
