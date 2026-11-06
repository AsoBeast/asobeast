"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ACTION_PRIORITIES } from "@asobeast/shared";
import type { ActionItem, ActionSummary } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { actionsOptions, actionSummaryFor } from "@/lib/queries";
import { ACTION_PRIORITY_LABEL } from "./action-copy";
import { actionHeadline } from "./action-headline";
import { ActionPriorityBadge } from "./ActionPriorityBadge";

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
          {`${summary.openByPriority[priority]} ${ACTION_PRIORITY_LABEL[priority]}`}
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
    <ul className="flex list-none flex-col gap-1 p-0">
      {list.items.slice(0, TOP_ACTION_LIMIT).map((item) => (
        <li key={item.id}>
          <TopActionLink
            item={item}
            href={`/apps/${appId}/actions?action=${item.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

function TopActionLink({
  item,
  href,
  children,
}: {
  item: ActionItem;
  href: string;
  children?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-10 flex-col gap-1 rounded-md px-2 py-2 text-sm outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-start gap-2">
        <ActionPriorityBadge priority={item.priority} />
        <span>{actionHeadline(item)}</span>
        {item.reopenCount > 0 ? (
          <Badge variant="outline">Reopened {item.reopenCount}×</Badge>
        ) : null}
      </span>
      {children}
    </Link>
  );
}

function AppActions({ appId }: { appId: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));

  return (
    <>
      <PriorityCounts summary={summary} />
      <AppActionList appId={appId} summary={summary} />
    </>
  );
}

export function ActionsSummaryCard({ appId }: { appId: string }) {
  const href = `/apps/${appId}/actions`;

  return (
    <Card>
      <CardHeader>
        <CardTitle asChild>
          <div>Top actions</div>
        </CardTitle>
        <CardDescription>
          The highest-impact open work, computed from your stored data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <AppActions appId={appId} />

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
