"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { ACTION_PRIORITIES } from "@asobeast/shared";
import type { ActionItem, ActionSummary } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DASHBOARD_ACTION_LIMIT, TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { storeLabel } from "@/lib/format";
import {
  actionsOptions,
  actionSummaryOptions,
  appActionSummaryOptions,
  portfolioOptions,
} from "@/lib/queries";
import { ACTION_PRIORITY_LABEL, ACTION_RULE_TITLE } from "./action-copy";
import { ActionPriorityBadge } from "./ActionPriorityBadge";
import { PriorityBar } from "./PriorityBar";

const openActions = (limit: number) => ({
  status: ["OPEN" as const],
  limit,
});

function EmptyActions({ summary }: { summary: ActionSummary }) {
  return (
    <p className="text-sm text-muted-foreground">
      {summary.generatedAt === null
        ? "No actions generated yet."
        : "Nothing to do right now."}
    </p>
  );
}

function PriorityCounts({ summary }: { summary: ActionSummary }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTION_PRIORITIES.map((priority) => (
        <Badge key={priority} variant="outline">
          {summary.byPriority[priority]} {ACTION_PRIORITY_LABEL[priority]}
        </Badge>
      ))}
    </div>
  );
}

function AppActionList({
  appId,
  summary,
}: {
  appId: string;
  summary: ActionSummary;
}) {
  const { data: list } = useSuspenseQuery(
    actionsOptions(openActions(TOP_ACTION_LIMIT), appId),
  );
  if (list.items.length === 0) return <EmptyActions summary={summary} />;

  return (
    <ul className="flex list-none flex-col gap-2 p-0">
      {list.items.slice(0, TOP_ACTION_LIMIT).map((item) => (
        <li key={item.id} className="flex items-start gap-2 text-sm">
          <ActionPriorityBadge priority={item.priority} />
          <span>{ACTION_RULE_TITLE[item.rule]}</span>
        </li>
      ))}
    </ul>
  );
}

function ActionScopeLine({
  item,
  iconUrl,
}: {
  item: ActionItem;
  iconUrl: string | null;
}) {
  const { appName, store, country } = item.scope;
  return (
    <span className="flex min-w-0 items-center gap-2 text-caption text-muted-foreground">
      <AppIcon src={iconUrl} name={appName} size={16} />
      <span className="truncate">
        {appName ?? "Unknown app"} · {storeLabel(store)} ·{" "}
        {country.toUpperCase()}
      </span>
    </span>
  );
}

function PortfolioActionList({ summary }: { summary: ActionSummary }) {
  const { data: list } = useSuspenseQuery(
    actionsOptions(openActions(DASHBOARD_ACTION_LIMIT)),
  );
  const { data: portfolio } = useSuspenseQuery(portfolioOptions);
  if (list.items.length === 0) return <EmptyActions summary={summary} />;

  const icons = new Map(portfolio.apps.map((app) => [app.id, app.iconUrl]));

  return (
    <ul className="flex list-none flex-col gap-1 p-0">
      {list.items.slice(0, DASHBOARD_ACTION_LIMIT).map((item) => (
        <li key={item.id}>
          <Link
            href={`/actions?action=${item.id}`}
            className="flex min-h-10 flex-col gap-1 rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex items-start gap-2">
              <ActionPriorityBadge priority={item.priority} />
              <span>{ACTION_RULE_TITLE[item.rule]}</span>
            </span>
            <ActionScopeLine
              item={item}
              iconUrl={icons.get(item.scope.appId) ?? null}
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AllClear() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <CircleCheck className="size-4 text-signal-up" aria-hidden />
      Nothing needs you right now.
    </p>
  );
}

function PortfolioActions() {
  const { data: summary } = useSuspenseQuery(actionSummaryOptions);
  if (summary.generatedAt !== null && summary.open === 0) return <AllClear />;

  return (
    <>
      <PriorityBar counts={summary.byPriority} />
      <PriorityCounts summary={summary} />
      <PortfolioActionList summary={summary} />
    </>
  );
}

function AppActions({ appId }: { appId: string }) {
  const { data: summary } = useSuspenseQuery(appActionSummaryOptions(appId));

  return (
    <>
      <PriorityCounts summary={summary} />
      <AppActionList appId={appId} summary={summary} />
    </>
  );
}

export function ActionsSummaryCard({ appId }: { appId?: string }) {
  const href = appId ? `/apps/${appId}/actions` : "/actions";
  const Title = appId ? "div" : "h2";

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <Title>Top actions</Title>
        </CardTitle>
        <CardDescription>
          The highest-impact open work, computed from your stored data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {appId ? <AppActions appId={appId} /> : <PortfolioActions />}

        <Link
          href={href}
          className="inline-flex min-h-6 items-center self-start text-sm font-medium underline-offset-4 hover:underline print:hidden"
        >
          Open the Action Center
        </Link>
      </CardContent>
    </Card>
  );
}
