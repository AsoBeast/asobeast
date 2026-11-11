"use client";

import { Suspense, useMemo, useRef, useState, type RefObject } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import type { DiscoveryState, Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { visibleDiscoveries } from "@/lib/keyword-discoveries";
import { keywordDiscoveriesOptions } from "@/lib/queries";
import { KeywordsToolbar } from "../KeywordsToolbar";
import { DiscoveredSkeleton } from "../skeletons";
import { DiscoveredTable } from "./DiscoveredTable";
import { selectedIn } from "./discovery-actions";
import { DiscoveryRowActionsContext } from "./discovery-row-actions";
import { DiscoveryToolbar } from "./DiscoveryToolbar";
import { useDiscoveryActions } from "./use-discovery-actions";
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
  const heading = useRef<HTMLHeadingElement>(null);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          ref={heading}
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
        <DiscoveredList key={props.market} {...props} heading={heading} />
      </Suspense>
    </div>
  );
}

const NO_SELECTION: RowSelectionState = {};

function useStateSelection(state: DiscoveryState) {
  const [selection, setSelection] = useState({
    state,
    rows: NO_SELECTION,
  });
  const rows = selection.state === state ? selection.rows : NO_SELECTION;
  const onChange: OnChangeFn<RowSelectionState> = (update) =>
    setSelection((current) => {
      const before = current.state === state ? current.rows : NO_SELECTION;
      return {
        state,
        rows: typeof update === "function" ? update(before) : update,
      };
    });
  const clear = () => setSelection({ state, rows: NO_SELECTION });
  return { rows, onChange, clear };
}

function DiscoveredList({
  id,
  store,
  market,
  heading,
}: DiscoveredProps & { heading: RefObject<HTMLHeadingElement | null> }) {
  const { data: list, dataUpdatedAt } = useSuspenseQuery(
    keywordDiscoveriesOptions(id, market),
  );
  const [state, setState] = useDiscoveryState();
  const selection = useStateSelection(state);
  const actions = useDiscoveryActions(id, market, selection.clear);
  const handOffFocus = useFocusAfterCommit();
  const rows = useMemo(
    () => visibleDiscoveries(list.items, state),
    [list.items, state],
  );
  const selected = selectedIn(rows, selection.rows);
  const empty = emptyStateOf(list, rows.length, state);

  return (
    <DiscoveryRowActionsContext value={{ actions, handOffFocus, heading }}>
      <div className="flex flex-col gap-4">
        <DiscoveryStateTabs counts={list.counts} />
        <DiscoveryToolbar
          list={list}
          market={market}
          selected={selected}
          actions={actions}
        />
        {empty.kind === "never_run" ? (
          <EmptyState title="No discoveries yet" body={empty.body} />
        ) : null}
        {empty.kind === "nothing_here" ? (
          <EmptyState
            title={empty.title}
            body={empty.body}
            action={
              state === "all" ? null : (
                <Button
                  variant="link"
                  size="sm"
                  onClick={(event) => {
                    handOffFocus(heading.current, event.currentTarget);
                    setState("all");
                  }}
                >
                  Show all
                </Button>
              )
            }
          />
        ) : null}
        {empty.kind === "none" ? (
          <DiscoveredTable
            key={state}
            rows={rows}
            store={store}
            rowSelection={selection.rows}
            onRowSelectionChange={selection.onChange}
          />
        ) : null}
        <DiscoveryFooter list={list} updatedAt={dataUpdatedAt} />
      </div>
    </DiscoveryRowActionsContext>
  );
}
