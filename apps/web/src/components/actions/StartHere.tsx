"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import type { ActionItem, ActionUpdateRequest } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { PANEL_COUNT, PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ACTION_EVIDENCE_UNAVAILABLE, summarizeEvidence } from "./action-copy";
import { actionHeadline } from "./action-headline";
import { actionHref, actionSection } from "./action-links";
import { actionSteps } from "./action-steps";
import { ActionSnoozeMenu } from "./ActionSnoozeMenu";
import { ImpactFigure } from "./ImpactFigure";
import { NumberedSteps } from "./NumberedSteps";
import { PRIORITY_COLUMNS, PriorityWord } from "./PriorityWord";
import { searchInput } from "./row-focus";
import { useActionUpdate } from "./use-action-update";

function StartControls({
  item,
  onOpen,
  onLeave,
}: {
  item: ActionItem;
  onOpen: () => void;
  onLeave: () => void;
}) {
  const { update: send, isPending: busy } = useActionUpdate(item);
  const update = (body: ActionUpdateRequest) => {
    onLeave();
    send(body);
  };
  const href = actionHref(item);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild size="sm">
        <Link href={href}>
          {`Fix it in ${actionSection(href)}`}
          <ArrowRight aria-hidden />
        </Link>
      </Button>
      <Button
        variant="secondary"
        size="sm"
        aria-disabled={busy || undefined}
        onClick={() => update({ status: "DONE" })}
      >
        <Check aria-hidden />
        Done
      </Button>
      <ActionSnoozeMenu
        status={item.status}
        snoozedUntil={item.snoozedUntil}
        busy={busy}
        onSnooze={(snoozedUntil) => update({ status: "SNOOZED", snoozedUntil })}
        onWake={() => update({ status: "OPEN" })}
      />
      <Button variant="ghost" size="sm" onClick={onOpen}>
        See the evidence
      </Button>
    </div>
  );
}

export function StartHere({
  items,
  truncated,
  iconOf,
  onOpen,
}: {
  items: readonly ActionItem[];
  truncated: boolean;
  iconOf?: (appId: string) => string | null;
  onOpen: (id: string) => void;
}) {
  const headline = useRef<HTMLParagraphElement>(null);
  const handOffFocus = useFocusAfterCommit();
  const open = items.filter((item) => item.status === "OPEN");
  const top = open.reduce<ActionItem | null>(
    (best, item) => (best === null || item.impact > best.impact ? item : best),
    null,
  );
  if (top === null) return null;

  return (
    <section aria-labelledby="start-heading">
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id="start-heading">Start here</h2>
          </CardTitle>
          {truncated ? null : (
            <CardAction className={PANEL_COUNT}>
              {`highest impact of ${formatNumber(open.length)} open`}
            </CardAction>
          )}
        </CardHeader>
        <CardContent
          className={cn(
            "grid gap-x-3 gap-y-3 @max-2xl/queue:grid-cols-1",
            PRIORITY_COLUMNS,
          )}
        >
          <PriorityWord priority={top.priority} />
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-1">
                <p
                  ref={headline}
                  tabIndex={-1}
                  className="rounded-sm text-heading text-pretty outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {actionHeadline(top)}
                </p>
                <div className="flex max-w-[70ch] flex-wrap items-center gap-x-2 gap-y-1 text-dense text-muted-foreground">
                  {iconOf ? (
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <AppIcon src={iconOf(top.scope.appId)} size={16} />
                      <span>{top.scope.appName ?? "Unknown app"}</span>
                    </span>
                  ) : null}
                  <span>
                    {top.evidence
                      ? summarizeEvidence(top.evidence)
                      : ACTION_EVIDENCE_UNAVAILABLE}
                  </span>
                </div>
              </div>
              <ImpactFigure impact={top.impact} labelled />
            </div>
            <NumberedSteps
              steps={actionSteps(top)}
              muteLast
              className="gap-2"
            />
            <StartControls
              key={top.id}
              item={top}
              onOpen={() => onOpen(top.id)}
              onLeave={() =>
                handOffFocus(open.length > 1 ? headline.current : searchInput())
              }
            />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
