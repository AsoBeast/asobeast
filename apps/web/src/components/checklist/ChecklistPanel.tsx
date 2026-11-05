"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { GOAL_COPY, ITEM_COPY } from "./checklist-copy";
import { nextItemId, pillLabel, ringFraction } from "./checklist-progress";

export interface ChecklistPanelProps {
  checklist: WorkspaceChecklist;
  titleId: string;
  summaryId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
  onNavigate: () => void;
}

function DoneRow({ item }: { item: WorkspaceChecklistItem }) {
  return (
    <li className="flex items-center gap-2" title={ITEM_COPY[item.id].doneText}>
      <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
      <span className="flex-1">{item.title}</span>
      <span className="text-caption text-muted-foreground">Done</span>
    </li>
  );
}

function OpenRow({
  item,
  next,
  onNavigate,
}: {
  item: WorkspaceChecklistItem;
  next: boolean;
  onNavigate: () => void;
}) {
  const copy = ITEM_COPY[item.id];
  const href = copy.href(item.appId);
  return (
    <li className="flex gap-2">
      <Circle
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.title}</span>
          {next ? <Badge variant="info">Next</Badge> : null}
        </div>
        <p className="text-muted-foreground">{copy.description}</p>
        {href === null ? (
          <span className="text-caption text-muted-foreground">
            Import an app first
          </span>
        ) : (
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link href={href} onClick={onNavigate}>
              {copy.action}
            </Link>
          </Button>
        )}
      </div>
    </li>
  );
}

export function ChecklistPanel({
  checklist,
  titleId,
  summaryId,
  collapsed,
  onToggleCollapsed,
  onHide,
  onNavigate,
}: ChecklistPanelProps) {
  const { done, total, goal, items } = checklist;
  const next = nextItemId(items);
  const progress = pillLabel(done, total);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PopoverTitle id={titleId} className="text-body">
          Setup checklist
        </PopoverTitle>
        <PopoverDescription id={summaryId}>{progress}</PopoverDescription>
        {goal ? (
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <span>{`Goal: ${GOAL_COPY[goal].label}`}</span>
            <Link
              href="/settings#getting-started"
              onClick={onNavigate}
              className="text-foreground underline decoration-primary underline-offset-4"
            >
              Change
            </Link>
          </p>
        ) : null}
      </div>
      <Progress
        value={ringFraction(done, total) * 100}
        aria-label="Setup progress"
        getValueLabel={() => progress}
        indicatorClassName="bg-success"
      />
      <ol aria-label="Checklist steps" className="flex flex-col gap-3">
        {items.map((item) =>
          item.done ? (
            <DoneRow key={item.id} item={item} />
          ) : (
            <OpenRow
              key={item.id}
              item={item}
              next={item.id === next}
              onNavigate={onNavigate}
            />
          ),
        )}
      </ol>
      <div className="flex flex-wrap justify-end gap-2 border-t pt-2">
        <Button variant="ghost" size="sm" onClick={onToggleCollapsed}>
          {collapsed ? "Expand the pill" : "Shrink the pill"}
        </Button>
        <Button variant="ghost" size="sm" onClick={onHide}>
          Hide checklist
        </Button>
      </div>
    </div>
  );
}
