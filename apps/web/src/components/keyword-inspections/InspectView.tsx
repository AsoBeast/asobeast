"use client";

import { Suspense, useEffect, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import type { KeywordInspectionSummary } from "@asobeast/shared";
import { MousePointerClick } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { EmptyState } from "@/components/ui/empty-state";
import {
  keywordInspectionOptions,
  keywordInspectionsOptions,
} from "@/lib/queries";
import { inspectParsers } from "@/lib/search-params";
import { InspectForm } from "./InspectForm";
import { InspectionDetail } from "./InspectionDetail";
import { InspectionLog } from "./InspectionLog";
import { InspectionMap } from "./InspectionMap";
import { inspectionCountry } from "./inspection-format";
import { inspectionPoints, type Storefront } from "./inspection-map";
import { NextHops } from "./NextHops";
import { InspectWorkspaceSkeleton } from "./skeletons";

export type InspectTarget = Pick<
  KeywordInspectionSummary,
  "id" | "keyword" | "store" | "country"
>;

function InspectWorkspace({
  selected,
  fallback,
  formKeyword,
  onSelect,
}: {
  selected: string | null;
  fallback: Storefront;
  formKeyword: string;
  onSelect: (target: InspectTarget | null) => void;
}) {
  const { data } = useSuspenseQuery(keywordInspectionsOptions);
  const detail = useQuery({
    ...keywordInspectionOptions(selected ?? ""),
    enabled: selected !== null,
  });
  const { thresholds } = useZoneThresholds();
  const [preview, setPreview] = useState<string | null>(null);
  const summary = data.items.find((item) => item.id === selected);
  const current = summary ?? (selected === null ? undefined : detail.data);
  const storefront: Storefront = current
    ? { store: current.store, country: current.country }
    : fallback;
  const points = inspectionPoints(data.items, storefront, thresholds);
  const unfilled = current !== undefined && formKeyword === "" ? current : null;
  useEffect(() => {
    if (unfilled) onSelect(unfilled);
  }, [unfilled, onSelect]);
  const done = detail.data?.status === "DONE" ? detail.data : null;
  const selectId = (id: string) => {
    const target = data.items.find((item) => item.id === id);
    if (target) onSelect(target);
  };

  return (
    <>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_30rem]">
        <InspectionMap
          points={points}
          storefront={storefront}
          selectedKeywordId={current?.keywordId ?? null}
          previewKeyword={preview}
          onSelect={(point) => onSelect({ ...point, ...storefront })}
          footer={
            done ? (
              <NextHops
                inspection={done}
                items={data.items}
                onSelect={selectId}
                onPreview={setPreview}
              />
            ) : null
          }
        />
        <div className="min-w-0 rounded-lg border bg-card p-4 shadow-raised sm:p-6">
          {selected ? (
            <InspectionDetail id={selected} onInspected={onSelect} />
          ) : (
            <EmptyState
              icon={MousePointerClick}
              title="No inspection selected"
              body="Inspect a keyword above, or pick a point on the map."
            />
          )}
        </div>
      </div>
      <InspectionLog
        items={data.items}
        selected={selected}
        onSelect={selectId}
        onDeleted={(id) => {
          if (selected === id) onSelect(null);
        }}
      />
    </>
  );
}

export function InspectView() {
  const [search, setSearch] = useQueryStates(inspectParsers);
  const show = (target: InspectTarget | null) =>
    void setSearch(
      target === null
        ? { id: null }
        : {
            id: target.id,
            keyword: target.keyword,
            store: target.store,
            country: target.country,
          },
    );
  const country = inspectionCountry(search.country);

  return (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between xl:gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-display tracking-tight text-balance">
            Keyword inspector
          </h1>
          <p className="max-w-[60ch] text-body text-muted-foreground">
            Live search results, autocomplete and scores for any keyword, placed
            against everything you inspected before.
          </p>
        </header>
        <InspectForm
          key={`${search.keyword}|${search.store}|${country}`}
          className="xl:w-[46rem] xl:flex-nowrap"
          initial={{ keyword: search.keyword, store: search.store, country }}
          onInspected={show}
        />
      </div>
      <Suspense fallback={<InspectWorkspaceSkeleton />}>
        <InspectWorkspace
          selected={search.id}
          fallback={{ store: search.store, country }}
          formKeyword={search.keyword}
          onSelect={show}
        />
      </Suspense>
    </>
  );
}
