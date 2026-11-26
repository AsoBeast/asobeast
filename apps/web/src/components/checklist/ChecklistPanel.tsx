"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Circle } from "lucide-react";
import type {
  WorkspaceChecklist,
  WorkspaceChecklistItem,
} from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import {
  checklistGoalCopy,
  checklistItemCopy,
  checklistTips,
} from "./checklist-copy";
import { nextItemId, pillLabel, ringFraction } from "./checklist-progress";
import { CHECKLIST_LINK } from "./checklist-link";
import { FirstResults } from "./FirstResults";

export interface ChecklistPanelProps {
  checklist: WorkspaceChecklist;
  titleId: string;
  summaryId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onHide: () => void;
  onNavigate: () => void;
}

type LocalizedChecklistTip = ReturnType<typeof checklistTips>[number];

function DoneRow({ item }: { item: WorkspaceChecklistItem }) {
  const t = useTranslations("settings");
  const copy = checklistItemCopy(item.id, t);
  return (
    <li className="flex items-center gap-2" title={copy.doneText}>
      <Check className="size-4 shrink-0 text-foreground" aria-hidden />
      <span className="flex-1">{copy.title}</span>
      <span className="text-caption text-muted-foreground">
        {t("checklist.done")}
      </span>
    </li>
  );
}

function TipLink({
  tip,
  appId,
  onNavigate,
}: {
  tip: LocalizedChecklistTip;
  appId: string | null;
  onNavigate: () => void;
}) {
  const t = useTranslations("settings");
  const href = tip.href(appId);
  if (href === null) return <span>{tip.label}</span>;
  if (tip.external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className={CHECKLIST_LINK}
      >
        <span>{tip.label}</span>
        <span className="sr-only">{t("checklist.opensNewTab")}</span>
      </a>
    );
  }
  return (
    <Link href={href} onClick={onNavigate} className={CHECKLIST_LINK}>
      <span>{tip.label}</span>
    </Link>
  );
}

function ChecklistTips({
  item,
  onNavigate,
}: {
  item: WorkspaceChecklistItem;
  onNavigate: () => void;
}) {
  const t = useTranslations("settings");
  const tips = checklistTips(item.id, t);
  if (tips.length === 0) return null;
  return (
    <ul
      aria-label={t("checklist.worthKnowing", {
        item: checklistItemCopy(item.id, t).title,
      })}
      className="flex flex-col gap-1 text-caption"
    >
      {tips.map((tip) => (
        <li key={tip.label}>
          <TipLink tip={tip} appId={item.appId} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
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
  const t = useTranslations("settings");
  const copy = checklistItemCopy(item.id, t);
  const href = copy.href(item.appId);
  return (
    <li className="flex gap-2">
      <Circle
        className="mt-0.5 size-4 shrink-0 text-faint-foreground"
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{copy.title}</span>
          {next ? <Badge variant="brand">{t("checklist.next")}</Badge> : null}
        </div>
        <p className="text-muted-foreground">{copy.description}</p>
        {href === null ? (
          <span className="text-caption text-muted-foreground">
            {t("checklist.importFirst")}
          </span>
        ) : (
          <Button asChild size="sm" variant="outline" className="w-fit">
            <Link href={href} onClick={onNavigate}>
              {copy.action}
            </Link>
          </Button>
        )}
        <ChecklistTips item={item} onNavigate={onNavigate} />
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
  const t = useTranslations("settings");
  const { done, total, goal, items } = checklist;
  const next = nextItemId(items);
  const progress = pillLabel(done, total, t);
  const goalCopy = goal ? checklistGoalCopy(goal, t) : null;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <PopoverTitle id={titleId} className="text-body">
          {t("checklist.panelTitle")}
        </PopoverTitle>
        <PopoverDescription id={summaryId}>{progress}</PopoverDescription>
        {goal && goalCopy ? (
          <p className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            <span>{t("checklist.goal", { goal: goalCopy.label })}</span>
            <Link
              href="/settings#getting-started"
              onClick={onNavigate}
              className={CHECKLIST_LINK}
            >
              <span>{t("checklist.change")}</span>
            </Link>
          </p>
        ) : null}
      </div>
      <Progress
        value={ringFraction(done, total) * 100}
        aria-label={t("checklist.setupProgress")}
        getValueLabel={() => progress}
      />
      <FirstResults
        appId={items.find((item) => item.id === "import_app")?.appId ?? null}
        onNavigate={onNavigate}
      />
      <ol aria-label={t("checklist.steps")} className="flex flex-col gap-3">
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
          {collapsed ? t("checklist.expandPill") : t("checklist.shrinkPill")}
        </Button>
        <Button variant="ghost" size="sm" onClick={onHide}>
          {t("checklist.hideChecklist")}
        </Button>
      </div>
    </div>
  );
}
