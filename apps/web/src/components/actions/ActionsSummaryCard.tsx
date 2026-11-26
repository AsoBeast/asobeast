"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { TOP_ACTION_LIMIT } from "@/lib/action-filters";
import { formatNumber } from "@/lib/format";
import { actionsOptions, actionSummaryFor } from "@/lib/queries";
import { ActionLine } from "./ActionLine";
import { DoNextPanel, NoOpenActions } from "./DoNextPanel";

function ActionList({ appId }: { appId: string }) {
  const t = useTranslations("actions");
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { data: list } = useSuspenseQuery(
    actionsOptions({ status: ["OPEN"], limit: TOP_ACTION_LIMIT }, appId),
  );

  if (list.items.length === 0) {
    return <NoOpenActions generated={summary.generatedAt !== null} />;
  }

  return (
    <ul className="flex flex-col">
      {list.items.slice(0, TOP_ACTION_LIMIT).map((item) => (
        <li key={item.id}>
          <ActionLine
            item={item}
            href={`/apps/${appId}/actions?action=${item.id}`}
          >
            {item.reopenCount > 0 ? (
              <span>{t("reopened", { count: item.reopenCount })}</span>
            ) : null}
          </ActionLine>
        </li>
      ))}
    </ul>
  );
}

export function ActionsSummaryCard({ appId }: { appId: string }) {
  const t = useTranslations("actions");
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  const { critical, high } = summary.openByPriority;
  const counts = [
    t("openCount", { count: formatNumber(summary.open) }),
    critical > 0 ? t("criticalCount", { count: formatNumber(critical) }) : null,
    high > 0 ? t("highCount", { count: formatNumber(high) }) : null,
  ].filter((part) => part !== null);

  return (
    <DoNextPanel
      counts={summary.generatedAt === null ? null : counts.join(" · ")}
      href={`/apps/${appId}/actions`}
    >
      <ActionList appId={appId} />
    </DoNextPanel>
  );
}
