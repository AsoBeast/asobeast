"use client";

import type { RefObject } from "react";
import { Send } from "lucide-react";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { ReplyConfirmDialog } from "./ReplyConfirmDialog";
import { consoleLabel } from "./store-console";
import { postRules } from "./store-reply-access";

export function PostReplyDialog({
  store,
  text,
  label,
  disabled,
  busy,
  textRef,
  onPost,
}: {
  store: Store;
  text: string;
  label: string;
  disabled: boolean;
  busy: boolean;
  textRef: RefObject<HTMLTextAreaElement | null>;
  onPost: () => void;
}) {
  return (
    <ReplyConfirmDialog
      trigger={
        <Button
          size="sm"
          disabled={disabled}
          aria-disabled={busy || undefined}
          onClick={(event) => {
            if (busy) event.preventDefault();
          }}
        >
          <Send />
          {label}
        </Button>
      }
      title="Post this reply publicly?"
      description={`AsoBeast sends this text to ${consoleLabel(store)} as the reply to this review.`}
      cancelLabel="Keep editing"
      actionLabel="Post"
      textRef={textRef}
      onConfirm={onPost}
    >
      <ul className="w-full list-disc space-y-1 pl-4 text-start text-body text-muted-foreground">
        {postRules(store).map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      <blockquote
        dir="auto"
        className="w-full rounded-md border bg-muted/40 p-3 text-start text-body wrap-anywhere whitespace-pre-line"
      >
        {text}
      </blockquote>
    </ReplyConfirmDialog>
  );
}
