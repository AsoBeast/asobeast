"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { ActionLine } from "@/components/actions/ActionLine";
import { DoNextPanel, NoOpenActions } from "@/components/actions/DoNextPanel";
import { DASHBOARD_ACTION_LIMIT } from "@/lib/action-filters";
import { formatNumber, storeLabel } from "@/lib/format";
import {
  actionsOptions,
  actionSummaryOptions,
  portfolioOptions,
} from "@/lib/queries";

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
    return <NoOpenActions generated={summary.generatedAt !== null} />;
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
    <DoNextPanel
      counts={
        summary.generatedAt === null
          ? null
          : `${formatNumber(summary.open)} open`
      }
      href="/actions"
      className="h-full"
    >
      <ActionList />
    </DoNextPanel>
  );
}
