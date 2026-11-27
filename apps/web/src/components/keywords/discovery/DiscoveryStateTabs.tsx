"use client";

import { useQueryState } from "nuqs";
import { useTranslations } from "next-intl";
import {
  DISCOVERY_STATES,
  type DiscoveryState,
  type KeywordDiscoveryCounts,
} from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { discoveryStateParser } from "@/lib/search-params";

const STATE_LABELS: Record<DiscoveryState, string> = {
  all: "all",
  ranked: "ranked",
  opportunity: "opportunity",
};

export function useDiscoveryState() {
  const [state, setState] = useQueryState("state", discoveryStateParser);
  const select = (next: DiscoveryState) =>
    void setState(next === "all" ? null : next);
  return [state, select] as const;
}

export function DiscoveryStateTabs({
  counts,
}: {
  counts: KeywordDiscoveryCounts;
}) {
  const [state, setState] = useDiscoveryState();
  const t = useTranslations("keywordInspector");
  return (
    <Tabs
      value={state}
      onValueChange={(next) =>
        setState(discoveryStateParser.parse(next) ?? state)
      }
      className="max-w-full min-w-0"
    >
      <TabsList aria-label={t("discovery.states.aria")} scrollable>
        {DISCOVERY_STATES.map((value) => (
          <TabsOption key={value} value={value}>
            {t("discovery.states.count", {
              label: t(`discovery.states.${STATE_LABELS[value]}`),
              count: counts[value],
            })}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}
