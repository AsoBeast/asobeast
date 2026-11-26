"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import type { KeywordInspectionSummary } from "@asobeast/shared";
import { useQueryStates } from "nuqs";
import { useZoneThresholds } from "@/components/keywords/use-zone-thresholds";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  accountPlanOptions,
  keywordInspectionOptions,
  keywordInspectionsOptions,
} from "@/lib/queries";
import { inspectParsers } from "@/lib/search-params";
import { cn } from "@/lib/utils";
import { InspectForm } from "./InspectForm";
import { EmptyInspection, InspectionDetail } from "./InspectionDetail";
import { InspectionLog } from "./InspectionLog";
import { InspectionMap } from "./InspectionMap";
import { inspectionCostText, inspectionCountry } from "./inspection-format";
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
  const t = useTranslations("keywordInspector");
  const detail = useQuery({
    ...keywordInspectionOptions(selected ?? ""),
    enabled: selected !== null,
  });
  const { thresholds } = useZoneThresholds();
  const [previewed, setPreviewed] = useState<{
    selected: string | null;
    term: string | null;
  }>({ selected, term: null });
  const preview = previewed.selected === selected ? previewed.term : null;
  const setPreview = useCallback(
    (term: string | null) => setPreviewed({ selected, term }),
    [selected],
  );
  const summary = data.items.find((item) => item.id === selected);
  const current = summary ?? (selected === null ? undefined : detail.data);
  const storefront: Storefront = current
    ? { store: current.store, country: current.country }
    : fallback;
  const { store, country } = storefront;
  const points = useMemo(
    () => inspectionPoints(data.items, { store, country }, thresholds),
    [data.items, store, country, thresholds],
  );
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
    <div className="grid items-start gap-6 @5xl/inspect:grid-cols-[minmax(0,1fr)_30rem]">
      <InspectionMap
        points={points}
        storefront={storefront}
        selectedKeywordId={current?.keywordId ?? null}
        previewKeyword={preview}
        onSelect={(point) => onSelect({ ...point, ...storefront })}
        hops={
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
      <div className="min-w-0 @5xl/inspect:col-start-2 @5xl/inspect:row-span-2 @5xl/inspect:row-start-1">
        {selected ? (
          <InspectionDetail
            id={selected}
            items={data.items}
            onInspected={onSelect}
            onSelect={selectId}
          />
        ) : (
          <EmptyInspection
            title={t("inspector.empty.title")}
            body={t("inspector.empty.body")}
          />
        )}
      </div>
      <div className="min-w-0 @5xl/inspect:col-start-1 @5xl/inspect:row-start-2">
        <InspectionLog
          items={data.items}
          selected={selected}
          onSelect={selectId}
          onDeleted={(id) => {
            if (selected === id) onSelect(null);
          }}
        />
      </div>
    </div>
  );
}

function InspectCost() {
  const plan = useQuery(accountPlanOptions);
  const t = useTranslations("keywordInspector");
  return (
    <p
      aria-hidden={plan.isPending || undefined}
      className={cn(
        "text-caption text-faint-foreground",
        plan.isPending && "invisible",
      )}
    >
      {inspectionCostText(plan.data?.limits, t)}
    </p>
  );
}

export function InspectView() {
  const [search, setSearch] = useQueryStates(inspectParsers);
  const t = useTranslations("keywordInspector");
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
      <PageHeader
        title={t("inspector.title")}
        controls={
          <div className="flex w-full flex-col gap-1.5 xl:w-auto xl:items-end">
            <InspectForm
              className="xl:w-[46rem] xl:flex-nowrap"
              initial={{
                keyword: search.keyword,
                store: search.store,
                country,
              }}
              onInspected={show}
            />
            <InspectCost />
          </div>
        }
      />
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
