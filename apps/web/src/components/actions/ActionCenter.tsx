"use client";

import { Suspense, useDeferredValue } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { PANEL_ACTION, PANEL_BLEED } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { queueFilters } from "@/lib/action-filters";
import { useFocusAfterCommit } from "@/lib/focus-handoff";
import { actionsOptions, portfolioOptions } from "@/lib/queries";
import { ActionBulkBar } from "./ActionBulkBar";
import { ActionCenterHeader } from "./ActionCenterHeader";
import { ActionDetailSheet } from "./ActionDetailSheet";
import { ActionEmptyState } from "./ActionEmptyState";
import { ActionOverview } from "./ActionOverview";
import { ActionQueue, QueueColumnHead } from "./ActionQueue";
import { ActionRail } from "./ActionRail";
import { ActionShortcutsDialog } from "./ActionShortcutsDialog";
import { ActionToolbar } from "./ActionToolbar";
import {
  filterQueue,
  isDefaultStatusSet,
  isFilteredView,
  leavesDefaultQueue,
} from "./queue-filters";
import { groupQueue, sortQueue } from "./queue-groups";
import { bulkFocusTarget } from "./row-focus";
import { QueueFooter } from "./QueueFooter";
import {
  ACTIONS_GRID,
  ActionOverviewSkeleton,
  QUEUE_COLUMN,
  QUEUE_SECTION,
} from "./skeletons";
import { StartHere } from "./StartHere";
import { StatusTabs } from "./StatusTabs";
import { useActionSheet } from "./use-action-sheet";
import { useBulkUpdate } from "./use-bulk-update";
import { useQueueKeys } from "./use-queue-keys";
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
  const handOffFocus = useFocusAfterCommit();
  const settleSelection = (removesRows: boolean) => {
    if (selection.selected.length === 0) return;
    handOffFocus(bulkFocusTarget(selection.selected, removesRows));
    selection.clear();
  };
  const clearSelection = () => settleSelection(false);
  const groups = groupQueue(
    visible,
    appId && view.group === "app" ? "priority" : view.group,
  );
  const keys = useQueueKeys({
    ids: groups.flatMap((group) => group.items.map((item) => item.id)),
    onOpen: sheet.open,
    onSelect: (id) => {
      if (selection.selectable.includes(id)) selection.toggle(id);
    },
    onClear: clearSelection,
  });

  const { data: portfolio } = useQuery({
    ...portfolioOptions,
    enabled: appId === undefined,
  });
  const icons = new Map(portfolio?.apps.map((app) => [app.id, app.iconUrl]));
  const iconOf = appId ? undefined : (id: string) => icons.get(id) ?? null;

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
      <div className={ACTIONS_GRID}>
        <div className={QUEUE_COLUMN}>
          {isDefaultStatusSet(view.status) ? (
            <StartHere
              items={data.items}
              truncated={data.total > data.items.length}
              iconOf={iconOf}
              onOpen={sheet.open}
            />
          ) : null}
          <section
            id="queue"
            aria-labelledby="queue-heading"
            className={QUEUE_SECTION}
          >
            <ActionToolbar
              appId={appId}
              items={data.items}
              view={view}
              setView={setView}
              shown={visible.length}
            />
            <Card>
              <CardHeader className="flex min-h-[47px] flex-wrap items-center justify-between gap-2">
                <CardTitle asChild>
                  <h2 id="queue-heading">Queue</h2>
                </CardTitle>
                <CardAction className={`${PANEL_ACTION} min-w-0`}>
                  <StatusTabs
                    appId={appId}
                    status={view.status}
                    onChange={(status) => void setView({ status })}
                  />
                </CardAction>
              </CardHeader>
              <CardContent className={PANEL_BLEED}>
                {visible.length === 0 ? (
                  <ActionEmptyState
                    generatedAt={data.generatedAt}
                    filtered={filtered}
                    onClearFilters={() => void setView(CLEARED_VIEW)}
                  />
                ) : (
                  <>
                    <QueueColumnHead />
                    <ActionQueue
                      groups={groups}
                      focusedId={sheet.id}
                      iconOf={iconOf}
                      hrefFor={sheet.hrefFor}
                      onOpen={(item) => sheet.open(item.id)}
                      selection={selection}
                      keyboardId={keys.focusedId}
                      onRowFocus={keys.setFocusedId}
                    />
                  </>
                )}
              </CardContent>
              <CardFooter className="flex-wrap justify-between gap-y-1">
                <QueueFooter
                  loaded={data.items.length}
                  total={data.total}
                  onShowShortcuts={() => keys.setHelpOpen(true)}
                />
              </CardFooter>
            </Card>
            <ActionBulkBar
              count={selection.selected.length}
              shown={selection.selectable.length}
              busy={bulk.isPending}
              onUpdate={(body) => {
                bulk.update({ ...body, ids: selection.selected });
                settleSelection(leavesDefaultQueue(body.status));
              }}
              onSelectAll={() => selection.setMany(selection.selectable, true)}
              onClear={clearSelection}
            />
          </section>
        </div>
        <ActionRail appId={appId} iconOf={iconOf} setView={setView} />
      </div>
      <ActionDetailSheet id={sheet.id} onClose={sheet.close} />
      <ActionShortcutsDialog
        open={keys.helpOpen}
        onOpenChange={keys.setHelpOpen}
      />
    </>
  );
}
