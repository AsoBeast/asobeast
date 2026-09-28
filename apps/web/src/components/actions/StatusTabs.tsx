"use client";

import { Suspense } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { ActionStatus } from "@asobeast/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/format";
import { actionSummaryFor } from "@/lib/queries";
import { presetCount, presetOf, STATUS_PRESETS } from "./status-presets";

interface StatusTabsProps {
  status: readonly ActionStatus[];
  onChange: (next: ActionStatus[] | null) => void;
}

function Tabbed({
  status,
  onChange,
  byStatus,
}: StatusTabsProps & { byStatus: Record<ActionStatus, number> | null }) {
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
      <TabsList
        aria-label="Action status"
        className="max-w-full justify-start overflow-x-auto overflow-y-hidden"
      >
        {STATUS_PRESETS.map((preset) => (
          <TabsTrigger
            key={preset.key}
            value={preset.key}
            className="flex-none"
          >
            {preset.label}
            {byStatus ? (
              <span
                aria-hidden
                className="numeric font-mono text-muted-foreground"
              >
                {formatNumber(presetCount(preset, byStatus))}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
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
