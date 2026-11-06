"use client";

import { useQueryState } from "nuqs";
import {
  DISCOVERY_STATES,
  type DiscoveryState,
  type KeywordDiscoveryCounts,
} from "@asobeast/shared";
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { discoveryStateParser } from "@/lib/search-params";

const STATE_LABELS: Record<DiscoveryState, string> = {
  all: "All",
  ranked: "Ranked",
  opportunity: "Opportunities",
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
  return (
    <Tabs
      value={state}
      onValueChange={(next) =>
        setState(discoveryStateParser.parse(next) ?? state)
      }
      className="max-w-full min-w-0"
    >
      <TabsList aria-label="Discovered keyword states" scrollable>
        {DISCOVERY_STATES.map((value) => (
          <TabsOption key={value} value={value}>
            {`${STATE_LABELS[value]} ${counts[value]}`}
          </TabsOption>
        ))}
      </TabsList>
    </Tabs>
  );
}
