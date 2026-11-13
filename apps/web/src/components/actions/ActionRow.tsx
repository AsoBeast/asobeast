"use client";

import { Check, RotateCcw, StickyNote } from "lucide-react";
import type { ActionItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { actionBrief, briefText } from "./action-brief";
import { actionHeadline } from "./action-headline";
import { actionStatusTag, type ActionStatusTag } from "./action-status-tag";
import { ActionBrief } from "./ActionBrief";
import { ActionRowMenu } from "./ActionRowMenu";
import { isClosed } from "./ActionStateControls";
import { ImpactFigure } from "./ImpactFigure";
import { opensInPlace } from "./opens-in-place";
import { PriorityWord } from "./PriorityWord";
import { QUEUE_ROW_COLUMNS } from "./queue-layout";
import { useActionUpdate } from "./use-action-update";
import type { QueueSelection } from "./use-queue-selection";

const ROW =
  "relative items-center gap-y-1 border-b border-border-subtle py-1 pr-1 pb-3 outline-none transition-colors duration-150 ease-out last:border-b-0 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset data-[checked=true]:bg-muted data-[focused=true]:bg-muted data-[focused=true]:shadow-[inset_2px_0_0_var(--foreground)] @2xl/queue:items-start @2xl/queue:py-3 @2xl/queue:pr-4 @2xl/queue:pl-4";

const SELECT_CELL =
  "relative z-20 col-start-1 row-start-1 flex size-11 items-center justify-center @2xl/queue:size-6";

function StateMark({ tag }: { tag: ActionStatusTag }) {
  return tag.tone === "warning" ? (
    <span className="text-label text-warning">{tag.label}</span>
  ) : (
    <Badge variant={tag.tone === "success" ? "success" : "flat"}>
      {tag.label}
    </Badge>
  );
}

function RowReason({
  item,
  iconUrl,
}: {
  item: ActionItem;
  iconUrl: string | null | undefined;
}) {
  const tag = actionStatusTag(item);
  const parts = item.evidence ? actionBrief(item.evidence) : [];

  return (
    <div className="col-span-3 col-start-2 row-start-3 flex min-w-0 flex-wrap items-start gap-x-2 gap-y-1 pr-2 text-caption text-muted-foreground @2xl/queue:pr-0">
      <span className="inline-flex shrink-0 items-center gap-2">
        {iconUrl === undefined ? null : (
          <>
            <AppIcon src={iconUrl} size={16} />
            <span className="font-medium text-foreground">
              {item.scope.appName ?? "Unknown app"}
            </span>
          </>
        )}
        <span className="text-faint-foreground">
          {item.scope.country.toUpperCase()}
        </span>
      </span>
      {parts.length > 0 ? (
        <span
          title={briefText(parts)}
          className="line-clamp-2 min-w-0 flex-[1_1_12rem]"
        >
          <ActionBrief parts={parts} />
        </span>
      ) : null}
      {tag ? <StateMark tag={tag} /> : null}
      {item.note ? (
        <span className="inline-flex">
          <StickyNote aria-hidden className="size-3.5" />
          <span className="sr-only">Has a note</span>
        </span>
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
  const { update, isPending: busy } = useActionUpdate(item, {
    moveFocus: true,
  });

  if (isClosed(item)) {
    return (
      <Button
        variant="outline"
        size="sm"
        aria-disabled={busy || undefined}
        className="h-11 @2xl/queue:h-7"
        onClick={() => update({ status: "OPEN" })}
      >
        <RotateCcw aria-hidden />
        Reopen
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        aria-disabled={busy || undefined}
        aria-label="Done"
        data-command="done"
        className="size-11 @2xl/queue:h-7 @2xl/queue:w-auto"
        onClick={() => update({ status: "DONE" })}
      >
        <Check aria-hidden />
        <span className="hidden @2xl/queue:inline">Done</span>
      </Button>
      <ActionRowMenu
        item={item}
        headline={headline}
        href={href}
        busy={busy}
        onUpdate={update}
      />
    </>
  );
}

export function ActionRow({
  item,
  focused,
  iconUrl,
  href,
  onOpen,
  selection,
  tabbable,
  onFocus,
}: {
  item: ActionItem;
  focused: boolean;
  iconUrl: string | null | undefined;
  href: string;
  onOpen: () => void;
  selection: QueueSelection;
  tabbable: boolean;
  onFocus: () => void;
}) {
  const headline = actionHeadline(item);
  const selectable = selection.selectable.includes(item.id);
  const checked = selectable && selection.isSelected(item.id);

  return (
    <li
      id={`action-${item.id}`}
      tabIndex={tabbable ? 0 : -1}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onFocus();
      }}
      data-focused={focused ? "true" : undefined}
      data-checked={checked ? "true" : undefined}
      className={cn(QUEUE_ROW_COLUMNS, ROW)}
    >
      {selectable ? (
        <label className={SELECT_CELL}>
          <Checkbox
            checked={checked}
            onCheckedChange={() => selection.toggle(item.id)}
            aria-label={`Select ${headline}`}
          />
        </label>
      ) : (
        <span aria-hidden className={SELECT_CELL} />
      )}
      <span className="col-start-2 row-start-1 flex">
        <PriorityWord priority={item.priority} />
      </span>
      <div className="contents @2xl/queue:col-start-3 @2xl/queue:row-start-1 @2xl/queue:flex @2xl/queue:min-w-0 @2xl/queue:flex-col @2xl/queue:gap-1">
        <a
          href={href}
          className="col-span-3 col-start-2 row-start-2 line-clamp-2 pr-2 text-body font-medium outline-none after:absolute after:inset-0 focus-visible:underline @2xl/queue:pr-0"
          onClick={(event) => {
            if (!opensInPlace(event)) return;
            event.preventDefault();
            onOpen();
          }}
        >
          {headline}
        </a>
        <RowReason item={item} iconUrl={iconUrl} />
      </div>
      <ImpactFigure
        impact={item.impact}
        className="col-start-3 row-start-1 px-2 @2xl/queue:col-start-4 @2xl/queue:self-center @2xl/queue:px-0"
      />
      <div className="relative z-20 col-start-4 row-start-1 flex items-center justify-end gap-1 @2xl/queue:col-start-5 @2xl/queue:self-center">
        <RowControls item={item} headline={headline} href={href} />
      </div>
    </li>
  );
}
