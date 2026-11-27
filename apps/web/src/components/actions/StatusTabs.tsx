"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { ActionStatus } from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { actionSummaryFor } from "@/lib/queries";
import { presetCount, presetOf, STATUS_PRESETS } from "./status-presets";

interface StatusTabsProps {
  status: readonly ActionStatus[];
  onChange: (next: ActionStatus[] | null) => void;
}

const PRESET_KEY = {
  todo: "todo",
  DONE: "done",
  DISMISSED: "dismissed",
  RESOLVED: "resolved",
} as const;

function Tabbed({
  status,
  onChange,
  byStatus,
}: StatusTabsProps & { byStatus: Record<ActionStatus, number> | null }) {
  const t = useTranslations("actions");
  return (
    <Tabs
      value={presetOf(status)?.key ?? ""}
      onValueChange={(key) => {
        const preset = STATUS_PRESETS.find((entry) => entry.key === key);
        if (!preset) return;
        onChange(preset.key === "todo" ? null : [...preset.statuses]);
      }}
      className="min-w-0 max-w-full"
    >
      <TabsList aria-label={t("statusAria")} scrollable>
        {STATUS_PRESETS.map((preset) => {
          const count = byStatus ? presetCount(preset, byStatus) : null;
          const label = t(`presets.${PRESET_KEY[preset.key]}`);
          return (
            <TabsOption
              key={preset.key}
              value={preset.key}
              aria-controls="queue"
              aria-label={
                count === null
                  ? undefined
                  : t("statusCount", { status: label, count })
              }
              className="flex-none"
            >
              {label}
              {count === null ? null : (
                <span className="numeric text-muted-foreground">
                  {formatNumber(count)}
                </span>
              )}
            </TabsOption>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function CountedTabs({
  appId,
  ...props
}: StatusTabsProps & { appId?: string }) {
  const { data: summary } = useSuspenseQuery(actionSummaryFor(appId));
  return <Tabbed {...props} byStatus={summary.byStatus} />;
}

export function StatusTabs(props: StatusTabsProps & { appId?: string }) {
  return (
    <Suspense fallback={<Tabbed {...props} byStatus={null} />}>
      <CountedTabs {...props} />
    </Suspense>
  );
}
