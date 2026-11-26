"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("reviews");
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
      title={t("post.title")}
      description={t("post.description", { console: consoleLabel(store) })}
      cancelLabel={t("post.keepEditing")}
      actionLabel={t("post.action")}
      textRef={textRef}
      onConfirm={onPost}
    >
      <ul className="w-full list-disc space-y-1 pl-4 text-start text-body text-muted-foreground">
        {postRules(store, t).map((rule) => (
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
