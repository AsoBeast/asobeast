"use client";

import { Suspense, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { visibleDiscoveries } from "@/lib/keyword-discoveries";
import { keywordDiscoveriesOptions } from "@/lib/queries";
import { KeywordsToolbar } from "../KeywordsToolbar";
import { DiscoveredSkeleton } from "../skeletons";
import { DiscoveredTable } from "./DiscoveredTable";
import { emptyStateOf } from "./discovery-rows";
import { DiscoveryFooter } from "./DiscoveryFooter";
import { DiscoveryStateTabs, useDiscoveryState } from "./DiscoveryStateTabs";

interface DiscoveredProps {
  id: string;
  store: Store;
  market: string;
  homeCountry: string;
}

export function DiscoveredKeywords(props: DiscoveredProps) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          tabIndex={-1}
          className="text-lg font-semibold text-balance outline-none"
        >
          Discovered keywords
        </h2>
        <p className="text-sm text-muted-foreground">
          Phrases near your listing that you do not track yet, and where your
          app ranks for them.
        </p>
      </div>
      <Suspense fallback={null}>
        <KeywordsToolbar
          id={props.id}
          store={props.store}
          market={props.market}
          homeCountry={props.homeCountry}
          showTrackedControls={false}
        />
      </Suspense>
      <Suspense fallback={<DiscoveredSkeleton />}>
        <DiscoveredList {...props} />
      </Suspense>
    </div>
  );
}

function DiscoveredList({ id, store, market }: DiscoveredProps) {
  const { data: list, dataUpdatedAt } = useSuspenseQuery(
    keywordDiscoveriesOptions(id, market),
  );
  const [state, setState] = useDiscoveryState();
  const rows = useMemo(
    () => visibleDiscoveries(list.items, state),
    [list.items, state],
  );
  const empty = emptyStateOf(list, rows.length, state);

  return (
    <div className="flex flex-col gap-4">
      <DiscoveryStateTabs counts={list.counts} />
      {empty.kind === "never_run" ? (
        <EmptyState
          title="No discoveries yet"
          body="AsoBeast looks for keywords near your listing once a week and right after you import an app. The first results appear within minutes of an import."
        />
      ) : null}
      {empty.kind === "nothing_here" ? (
        <EmptyState
          title={empty.title}
          body={empty.body}
          action={
            state === "all" ? null : (
              <Button variant="link" size="sm" onClick={() => setState("all")}>
                Show all
              </Button>
            )
          }
        />
      ) : null}
      {empty.kind === "none" ? (
        <DiscoveredTable key={`${market}:${state}`} rows={rows} store={store} />
      ) : null}
      <DiscoveryFooter list={list} updatedAt={dataUpdatedAt} />
    </div>
  );
}
