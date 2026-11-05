"use client";

import { Suspense } from "react";
import { ScanSearch } from "lucide-react";
import { useQueryStates } from "nuqs";
import { EmptyState } from "@/components/ui/empty-state";
import { inspectParsers } from "@/lib/search-params";
import { InspectForm } from "./InspectForm";
import { InspectionDetail } from "./InspectionDetail";
import { InspectionHistory } from "./InspectionHistory";
import { inspectionCountry } from "./inspection-format";
import { InspectionHistorySkeleton } from "./skeletons";

export function InspectView() {
  const [search, setSearch] = useQueryStates(inspectParsers);
  const show = (id: string | null) => void setSearch({ id });
  const forget = (id: string) => {
    if (search.id === id) show(null);
  };

  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">
          Keyword inspector
        </h1>
        <p className="text-body text-muted-foreground">
          Read the live search results, autocomplete and scores of any keyword
          in any storefront, before you decide to track it.
        </p>
      </header>
      <InspectForm
        initial={{
          keyword: search.keyword,
          store: search.store,
          country: inspectionCountry(search.country),
        }}
        onInspected={(inspection) => show(inspection.id)}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          {search.id ? (
            <InspectionDetail
              id={search.id}
              onInspected={(inspection) => show(inspection.id)}
            />
          ) : (
            <EmptyState
              icon={ScanSearch}
              title="No inspection selected"
              body="Enter a keyword above, or pick one of your recent inspections."
            />
          )}
        </div>
        <Suspense fallback={<InspectionHistorySkeleton />}>
          <InspectionHistory
            selected={search.id}
            onSelect={show}
            onDeleted={forget}
          />
        </Suspense>
      </div>
    </>
  );
}
