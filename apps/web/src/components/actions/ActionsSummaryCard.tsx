"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionItem } from "@asobeast/shared";
import {
  PANEL_ACTION,
  PANEL_HEADER,
} from "@/components/dashboard/layout-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { formatNumber } from "@/lib/format";
import { actionsOptions, actionSummaryFor } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ACTION_PRIORITY_LABEL, ACTION_PRIORITY_TONE } from "./action-copy";
import { actionHeadline } from "./action-headline";

function ActionLine({ item, href }: { item: ActionItem; href: string }) {
  return (
    <Link
      href={href}
      className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md px-2 py-2 outline-none transition-colors duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className={cn(
          "pt-0.5 text-tick font-semibold tracking-wide uppercase",
          ACTION_PRIORITY_TONE[item.priority],
        )}
      >
        {ACTION_PRIORITY_LABEL[item.priority]}
      </span>
      <span className="text-body">{actionHeadline(item)}</span>
      {item.reopenCount > 0 ? (
        <span className="col-start-2 text-caption text-muted-foreground">
          {`Reopened ${item.reopenCount}×`}
        </span>
      ) : null}
    </Link>
  );
}

function ActionList({ appId }: { appId: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: list } = useSuspenseQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }, appId),
  );

  if (list.items.length === 0) {
    return (
      <p className="px-2 text-body text-muted-foreground">
        {summary.generatedAt === null
          ? "No actions generated yet."
          : "Nothing needs you right now."}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {list.items.slice(0, TOP_ACTION_LIMIT).map((item) => (
        <li key={item.id}>
          <ActionLine
            item={item}
            href={`/apps/${appId}/actions?action=${item.id}`}
          />
        </li>
      ))}
    </ul>
  );
}

export function ActionsSummaryCard({ appId }: { appId: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { critical, high } = summary.openByPriority;
  const counts = [
    `${formatNumber(summary.open)} open`,
    critical > 0 ? `${formatNumber(critical)} critical` : null,
    high > 0 ? `${formatNumber(high)} high` : null,
  ].filter((part) => part !== null);

  return (
    <Card>
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Do next</h2>
        </CardTitle>
        {summary.generatedAt === null ? null : (
          <CardAction
            className={cn(PANEL_ACTION, "text-label text-faint-foreground")}
          >
            {counts.join(" · ")}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="px-2">
        <ActionList appId={appId} />
      </CardContent>
      <CardFooter className="justify-between">
        <span>Rules over your stored history</span>
        <Link
          href={`/apps/${appId}/actions`}
          className="inline-flex min-h-6 items-center text-foreground underline decoration-faint-foreground underline-offset-4 hover:decoration-foreground print:hidden"
        >
          Open the Action Center
        </Link>
      </CardFooter>
    </Card>
  );
}
