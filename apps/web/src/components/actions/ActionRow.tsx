"use client";

import type { MouseEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import type { ActionItem } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, storeLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ACTION_CATEGORY_LABEL } from "./action-copy";
import { actionHeadline } from "./action-headline";
import { actionStatusTag, type ActionStatusTag } from "./action-status-tag";
import { ActionImpactMeter } from "./ActionImpactMeter";
import { ActionPriorityBadge } from "./ActionPriorityBadge";
import { ActionRowMenu } from "./ActionRowMenu";
import { ActionSnoozeMenu } from "./ActionSnoozeMenu";
import { isClosed } from "./ActionStateControls";
import { useActionUpdate } from "./use-action-update";

const TAG_TONE: Record<ActionStatusTag["tone"], string> = {
  warning: "border-warning/40 text-warning",
  success: "border-success/40 text-success",
  neutral: "",
};

function opensInPlace(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

function RowMeta({
  item,
  appScoped,
}: {
  item: ActionItem;
  appScoped: boolean;
}) {
  const tag = actionStatusTag(item);
  const parts = [
    ACTION_CATEGORY_LABEL[item.category],
    appScoped ? null : (item.scope.appName ?? "Unknown app"),
    storeLabel(item.scope.store),
    item.scope.country.toUpperCase(),
    `since ${formatDate(item.firstSeenAt)}`,
  ].filter((part) => part !== null);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <p className="min-w-0 truncate text-caption text-muted-foreground">
        {parts.join(" · ")}
      </p>
      {tag ? (
        <Badge variant="outline" className={cn("h-auto", TAG_TONE[tag.tone])}>
          {tag.label}
        </Badge>
      ) : null}
    </div>
  );
}

function RowControls({
  item,
  headline,
  href,
}: {
  item: ActionItem;
  headline: string;
  href: string;
}) {
  const mutation = useActionUpdate(item, { moveFocus: true });
  const busy = mutation.isPending;

  if (isClosed(item)) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        className="h-11 @md/queue:h-7"
        onClick={() => mutation.mutate({ status: "OPEN" })}
      >
        <RotateCcw aria-hidden />
        Reopen
      </Button>
    );
  }

  return (
    <>
      <Button
        size="sm"
        disabled={busy}
        aria-label="Done"
        className="size-11 @md/queue:h-7 @md/queue:w-auto"
        onClick={() => mutation.mutate({ status: "DONE" })}
      >
        <Check aria-hidden />
        <span className="hidden @md/queue:inline">Done</span>
      </Button>
      <div className="hidden items-center gap-2 @md/queue:flex">
        <ActionSnoozeMenu
          status={item.status}
          snoozedUntil={item.snoozedUntil}
          disabled={busy}
          onSnooze={(snoozedUntil) =>
            mutation.mutate({ status: "SNOOZED", snoozedUntil })
          }
          onWake={() => mutation.mutate({ status: "OPEN" })}
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => mutation.mutate({ status: "DISMISSED" })}
        >
          <X aria-hidden />
          Dismiss
        </Button>
      </div>
      <ActionRowMenu
        item={item}
        headline={headline}
        href={href}
        disabled={busy}
        onUpdate={(body) => mutation.mutate(body)}
      />
    </>
  );
}

export function ActionRow({
  item,
  focused,
  appScoped,
  href,
  onOpen,
}: {
  item: ActionItem;
  focused: boolean;
  appScoped: boolean;
  href: string;
  onOpen: () => void;
}) {
  const headline = actionHeadline(item);

  return (
    <li
      id={`action-${item.id}`}
      tabIndex={-1}
      data-focused={focused ? "true" : undefined}
      className="relative grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-1 @md/queue:grid-cols-[auto_1fr_auto] rounded-lg border bg-card px-3 py-3 outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring data-[focused=true]:ring-2 data-[focused=true]:ring-ring"
    >
      <span aria-hidden className="w-4" />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex min-w-0 items-start gap-2">
          <ActionPriorityBadge priority={item.priority} compact />
          <a
            href={href}
            className="line-clamp-2 font-medium outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:underline"
            onClick={(event) => {
              if (!opensInPlace(event)) return;
              event.preventDefault();
              onOpen();
            }}
          >
            {headline}
          </a>
        </div>
        <RowMeta item={item} appScoped={appScoped} />
      </div>
      <div className="relative z-20 col-start-2 flex items-center justify-end gap-2 @md/queue:col-start-3 @md/queue:row-start-1">
        <ActionImpactMeter
          impact={item.impact}
          compact
          className="hidden w-16 @3xl/queue:block"
        />
        <RowControls item={item} headline={headline} href={href} />
      </div>
    </li>
  );
}
