"use client";

import { useMemo } from "react";
import {
  ACTION_CATEGORIES,
  ACTION_RULES,
  STORES,
  type ActionItem,
} from "@asobeast/shared";
import { FacetFilter } from "@/components/data-table/FacetFilter";
import { FilterChips } from "@/components/data-table/FilterChips";
import { RowCount } from "@/components/data-table/RowCount";
import { SearchInput } from "@/components/data-table/SearchInput";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCountry, storeLabel } from "@/lib/format";
import type { ActionGroup, ActionSort } from "@/lib/search-params";
import { ACTION_CATEGORY_LABEL, ACTION_RULE_LABEL } from "./action-copy";
import { PriorityToggles } from "./PriorityToggles";
import { queueChips } from "./queue-chips";
import { appLabel, facetCounts, type QueueFacetCounts } from "./queue-filters";
import { StatusTabs } from "./StatusTabs";
import type { QueueViewState, SetQueueView } from "./use-queue-view";

const GROUP_LABEL: Record<ActionGroup, string> = {
  priority: "Priority",
  app: "App",
  category: "Category",
};

const SORT_LABEL: Record<ActionSort, string> = {
  impact: "Impact",
  newest: "Newest",
  oldest: "Oldest",
};

function QueueSelect<T extends string>({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: T;
  labels: Partial<Record<T, string>>;
  onChange: (next: T) => void;
}) {
  const options = Object.entries(labels) as Array<[T, string]>;
  return (
    <Select
      value={value}
      onValueChange={(next) => {
        const option = options.find(([key]) => key === next);
        if (option) onChange(option[0]);
      }}
    >
      <SelectTrigger size="sm" aria-label={label}>
        <SelectValue>{labels[value]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map(([key, text]) => (
          <SelectItem key={key} value={key}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function present<T extends string>(
  values: readonly T[],
  order: readonly T[],
): T[] {
  return order.filter((value) => values.includes(value));
}

type FacetOptions = ReturnType<typeof useFacetOptions>;

function useFacetOptions(items: readonly ActionItem[], view: QueueViewState) {
  return useMemo(() => {
    const apps = new Map<string, string>();
    for (const item of items) apps.set(item.scope.appId, appLabel(item.scope));
    const markets = [
      ...new Set([...items.map((item) => item.scope.country), ...view.market]),
    ].sort();
    return {
      apps,
      rules: present(
        [...items.map((item) => item.rule), ...view.rule],
        ACTION_RULES,
      ),
      categories: present(
        [...items.map((item) => item.category), ...view.category],
        ACTION_CATEGORIES,
      ),
      markets,
      stores: present(
        items.map((item) => item.scope.store),
        STORES,
      ),
    };
  }, [items, view.market, view.rule, view.category]);
}

const CLEARED_FACETS = {
  priority: null,
  rule: null,
  category: null,
  app: null,
  market: null,
  store: null,
  q: null,
};

function QueueFacets({
  appId,
  view,
  setView,
  counts,
  options,
}: {
  appId?: string;
  view: QueueViewState;
  setView: SetQueueView;
  counts: QueueFacetCounts;
  options: FacetOptions;
}) {
  return (
    <>
      <FacetFilter
        title="Rule"
        options={options.rules.map((rule) => ({
          value: rule,
          label: ACTION_RULE_LABEL[rule],
        }))}
        selected={view.rule}
        counts={counts.rule}
        onChange={(rule) => void setView({ rule })}
      />
      <FacetFilter
        title="Category"
        options={options.categories.map((category) => ({
          value: category,
          label: ACTION_CATEGORY_LABEL[category],
        }))}
        selected={view.category}
        counts={counts.category}
        onChange={(category) => void setView({ category })}
      />
      {appId ? null : (
        <FacetFilter
          title="App"
          options={[...options.apps].map(([value, label]) => ({
            value,
            label,
          }))}
          selected={view.app}
          counts={counts.app}
          onChange={(app) => void setView({ app })}
        />
      )}
      <FacetFilter
        title="Market"
        options={options.markets.map((market) => ({
          value: market,
          label: formatCountry(market),
        }))}
        selected={view.market}
        counts={counts.market}
        onChange={(market) => void setView({ market })}
      />
      {options.stores.length > 1 ? (
        <FacetFilter
          title="Store"
          options={options.stores.map((store) => ({
            value: store,
            label: storeLabel(store),
          }))}
          selected={view.store ? [view.store] : []}
          counts={counts.store}
          onChange={(stores) => void setView({ store: stores.at(-1) ?? null })}
        />
      ) : null}
    </>
  );
}

export function ActionToolbar({
  appId,
  items,
  view,
  setView,
  shown,
  loadedTotal,
}: {
  appId?: string;
  items: readonly ActionItem[];
  view: QueueViewState;
  setView: SetQueueView;
  shown: number;
  loadedTotal: number;
}) {
  const counts = facetCounts(items, view);
  const options = useFacetOptions(items, view);
  const groups = appId
    ? { priority: GROUP_LABEL.priority, category: GROUP_LABEL.category }
    : GROUP_LABEL;

  return (
    <div className="flex flex-col gap-2">
      <div data-slot="action-toolbar" className="flex flex-col gap-2">
        <StatusTabs
          appId={appId}
          status={view.status}
          onChange={(status) => void setView({ status })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            label="Search actions"
            value={view.q}
            onSearch={(q, searchOptions) =>
              void setView({ q: q === "" ? null : q }, searchOptions)
            }
          />
          <PriorityToggles
            selected={view.priority}
            counts={counts.priority}
            onChange={(priority) => void setView({ priority })}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QueueFacets
            appId={appId}
            view={view}
            setView={setView}
            counts={counts}
            options={options}
          />
          <div className="flex items-center gap-2 @3xl/actions:ml-auto">
            <QueueSelect
              label="Group by"
              value={view.group}
              labels={groups}
              onChange={(group) => void setView({ group })}
            />
            <QueueSelect
              label="Sort by"
              value={view.sort}
              labels={SORT_LABEL}
              onChange={(sort) => void setView({ sort })}
            />
          </div>
        </div>
        <FilterChips
          chips={queueChips(view, options.apps).map((chip) => ({
            key: chip.key,
            label: chip.label,
            onRemove: () => void setView(chip.clear),
          }))}
          onClearAll={() => void setView(CLEARED_FACETS)}
        />
      </div>
      <RowCount shown={shown} total={items.length} noun="action" />
      {loadedTotal > items.length ? (
        <p className="text-caption text-muted-foreground">
          Only the {items.length} highest-impact actions are loaded; narrow the
          status or scope to see the rest.
        </p>
      ) : null}
    </div>
  );
}
