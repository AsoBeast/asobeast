"use client";

import { Suspense, useDeferredValue } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { queueFilters } from "@/lib/action-filters";
import { actionsOptions } from "@/lib/queries";
import { ActionBulkBar } from "./ActionBulkBar";
import { ActionCenterHeader } from "./ActionCenterHeader";
import { ActionDetailSheet } from "./ActionDetailSheet";
import { ActionEmptyState } from "./ActionEmptyState";
import { ActionOverview } from "./ActionOverview";
import { ActionQueue } from "./ActionQueue";
import { ActionToolbar } from "./ActionToolbar";
import {
  filterQueue,
  isDefaultStatusSet,
  isFilteredView,
} from "./queue-filters";
import { groupQueue, sortQueue } from "./queue-groups";
import { ActionOverviewSkeleton } from "./skeletons";
import { useActionSheet } from "./use-action-sheet";
import { useBulkUpdate } from "./use-bulk-update";
import { useQueueSelection } from "./use-queue-selection";
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
  const selection = useQueueSelection(visible, isDefaultStatusSet(view.status));
  const bulk = useBulkUpdate(appId);

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
      <section
        id="queue"
        aria-labelledby="queue-heading"
        className="@container/queue flex flex-col gap-4"
      >
        <h2 id="queue-heading" className="sr-only">
          Queue
        </h2>
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
          <ActionQueue
            groups={groupQueue(
              visible,
              appId && view.group === "app" ? "priority" : view.group,
            )}
            focusedId={sheet.id}
            appScoped={appId !== undefined}
            hrefFor={sheet.hrefFor}
            onOpen={(item) => sheet.open(item.id)}
            selection={selection}
          />
        )}
        <ActionBulkBar
          count={selection.selected.length}
          shown={selection.selectable.length}
          busy={bulk.isPending}
          onUpdate={(body) => {
            bulk.update({ ...body, ids: selection.selected });
            selection.clear();
          }}
          onSelectAll={() => selection.setMany(selection.selectable, true)}
          onClear={selection.clear}
        />
      </section>
      <ActionDetailSheet id={sheet.id} onClose={sheet.close} />
    </>
  );
}
