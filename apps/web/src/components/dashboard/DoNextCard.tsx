"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionItem, ActionPriority } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { ACTION_PRIORITY_LABEL } from "@/components/actions/action-copy";
import { actionHeadline } from "@/components/actions/action-headline";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DASHBOARD_ACTION_LIMIT } from "@/lib/action-filters";
import { formatNumber, storeLabel } from "@/lib/format";
import {
  actionsOptions,
  actionSummaryOptions,
  portfolioOptions,
} from "@/lib/queries";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<ActionPriority, string> = {
  critical: "text-priority-critical",
  high: "text-priority-high",
  medium: "text-priority-medium",
  low: "text-priority-low",
};

function ActionLine({
  item,
  iconUrl,
}: {
  item: ActionItem;
  iconUrl: string | null;
}) {
  const { appName, store, country } = item.scope;
  return (
    <Link
      href={`/actions?action=${item.id}`}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "pt-0.5 text-tick font-semibold tracking-wide uppercase",
          PRIORITY_TONE[item.priority],
        )}
      >
        {ACTION_PRIORITY_LABEL[item.priority]}
      </span>
      <span className="text-body">{actionHeadline(item)}</span>
      <span className="col-start-2 flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
        <AppIcon src={iconUrl} size={16} />
        <span className="truncate">
          {[
            appName ?? "Unknown app",
            storeLabel(store),
            country.toUpperCase(),
            item.reopenCount > 0 ? `Reopened ${item.reopenCount}×` : null,
          ]
            .filter((part) => part !== null)
            .join(" · ")}
        </span>
      </span>
    </Link>
  );
}

function ActionList() {
  const { data: summary } = useSuspenseQuery(actionSummaryOptions);
  const { data: list } = useSuspenseQuery(
    actionsOptions({ status: ["OPEN"], limit: DASHBOARD_ACTION_LIMIT }),
  );
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);

  if (list.items.length === 0) {
    return (
      <p className="px-2 text-body text-muted-foreground">
        {summary.generatedAt === null
          ? "No actions generated yet."
          : "Nothing needs you right now."}
      </p>
    );
  }

  const icons = new Map(portfolio.apps.map((app) => [app.id, app.iconUrl]));
  return (
    <ul className="flex flex-col">
      {list.items.slice(0, DASHBOARD_ACTION_LIMIT).map((item) => (
        <li key={item.id}>
          <ActionLine
            item={item}
            iconUrl={icons.get(item.scope.appId) ?? null}
          />
        </li>
      ))}
    </ul>
  );
}

export function DoNextCard() {
  const { data: summary } = useSuspenseQuery(actionSummaryOptions);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle asChild>
          <h2>Do next</h2>
        </CardTitle>
        {summary.generatedAt === null ? null : (
          <CardAction className="text-label text-faint-foreground">
            {`${formatNumber(summary.open)} open`}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex-1 px-2">
        <ActionList />
      </CardContent>
      <CardFooter className="justify-between">
        <span>Rules over your stored history</span>
        <Link
          href="/actions"
          className="inline-flex min-h-6 items-center text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground print:hidden"
        >
          Open the Action Center
        </Link>
      </CardFooter>
    </Card>
  );
}
