"use client";

import { Suspense, useDeferredValue, useEffect, useRef } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { queueFilters } from "@/lib/action-filters";
import { actionsOptions } from "@/lib/queries";
import { actionFocusParser } from "@/lib/search-params";
import { ActionCard } from "./ActionCard";
import { ActionCenterHeader } from "./ActionCenterHeader";
import { ActionEmptyState } from "./ActionEmptyState";
import { ActionOverview } from "./ActionOverview";
import { ActionToolbar } from "./ActionToolbar";
import { filterQueue, isFilteredView } from "./queue-filters";
import { sortQueue } from "./queue-groups";
import { ActionOverviewSkeleton } from "./skeletons";
import { useQueueView } from "./use-queue-view";

const CLEARED_VIEW = {
  status: null,
  priority: null,
  rule: null,
  category: null,
  app: null,
  market: null,
  store: null,
  q: null,
};

export function ActionCenter({ appId }: { appId?: string }) {
  const [view, setView] = useQueueView();
  const [focus] = useQueryState("action", actionFocusParser);
  const q = useDeferredValue(view.q);

  const { data } = useSuspenseQuery(
    actionsOptions(queueFilters(view.status), appId),
  );
  const visible = sortQueue(filterQueue(data.items, { ...view, q }), view.sort);

  const focusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focus || focusRef.current === focus) return;
    const card = document.getElementById(`action-${focus}`);
    if (!card) return;
    focusRef.current = focus;
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    card.querySelector("details")?.setAttribute("open", "true");
    card.setAttribute("tabindex", "-1");
    card.focus({ preventScroll: true });
  }, [focus, data]);

  const filtered = isFilteredView(view);
  const emptyStateGenerates =
    visible.length === 0 && (data.generatedAt === null || !filtered);

  return (
    <>
      <ActionCenterHeader
        appId={appId}
        generatedAt={data.generatedAt}
        showGenerate={!emptyStateGenerates}
      />
      <Suspense fallback={<ActionOverviewSkeleton />}>
        <ActionOverview appId={appId} />
      </Suspense>
      <ActionToolbar
        appId={appId}
        items={data.items}
        view={view}
        setView={setView}
        shown={visible.length}
        loadedTotal={data.total}
      />

      {visible.length === 0 ? (
        <ActionEmptyState
          generatedAt={data.generatedAt}
          filtered={filtered}
          onClearFilters={() => void setView(CLEARED_VIEW)}
        />
      ) : (
        <ul className="flex list-none flex-col gap-4 p-0">
          {visible.map((item) => (
            <li key={item.id}>
              <ActionCard item={item} focused={focus === item.id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
