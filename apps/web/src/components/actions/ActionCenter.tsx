"use client";

import { Suspense, useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queueFilters } from "@/lib/action-filters";
import { actionsOptions } from "@/lib/queries";
import { ActionCard } from "./ActionCard";
import { ActionCenterHeader } from "./ActionCenterHeader";
import { ActionDetailSheet } from "./ActionDetailSheet";
import { ActionEmptyState } from "./ActionEmptyState";
import { ActionOverview } from "./ActionOverview";
import { ActionToolbar } from "./ActionToolbar";
import { filterQueue, isFilteredView } from "./queue-filters";
import { sortQueue } from "./queue-groups";
import { ActionOverviewSkeleton } from "./skeletons";
import { useActionSheet } from "./use-action-sheet";
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
  const q = useDeferredValue(view.q);

  const { data } = useSuspenseQuery(
    actionsOptions(queueFilters(view.status), appId),
  );
  const visible = sortQueue(filterQueue(data.items, { ...view, q }), view.sort);

  const sheet = useActionSheet(view);

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
              <ActionCard
                item={item}
                focused={sheet.id === item.id}
                href={sheet.hrefFor(item.id)}
                onOpen={() => sheet.open(item.id)}
              />
            </li>
          ))}
        </ul>
      )}
      <ActionDetailSheet id={sheet.id} onClose={sheet.close} />
    </>
  );
}
