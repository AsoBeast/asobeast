"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { ActionLine } from "@/components/actions/ActionLine";
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
import { PANEL_ACTION, PANEL_HEADER } from "./layout-classes";

function ActionScope({
  item,
  iconUrl,
}: {
  item: ActionItem;
  iconUrl: string | null;
}) {
  const { appName, store, country } = item.scope;
  return (
    <>
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
    </>
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
          <ActionLine item={item} href={`/actions?action=${item.id}`}>
            <ActionScope
              item={item}
              iconUrl={icons.get(item.scope.appId) ?? null}
            />
          </ActionLine>
        </li>
      ))}
    </ul>
  );
}

export function DoNextCard() {
  const { data: summary } = useSuspenseQuery(actionSummaryOptions);
  return (
    <Card className="h-full">
      <CardHeader className={PANEL_HEADER}>
        <CardTitle asChild>
          <h2>Do next</h2>
        </CardTitle>
        {summary.generatedAt === null ? null : (
          <CardAction
            className={cn(PANEL_ACTION, "text-label text-faint-foreground")}
          >
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
