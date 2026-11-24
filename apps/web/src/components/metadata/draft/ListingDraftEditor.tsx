"use client";

import { useMemo, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import type { MetadataAuditResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  draftFieldsOf,
  draftRequest,
  draftScopeOf,
  liveDraftValues,
  scopeKey,
  type ListingDraftField,
} from "@/lib/listing-draft";
import { DraftCoveragePanel } from "./DraftCoveragePanel";
import { DraftFieldInput } from "./DraftFieldInput";
import { useCoveragePreview } from "./use-coverage-preview";
import { useListingDraft } from "./use-listing-draft";

export function ListingDraftEditor({
  id,
  audit,
  market,
  localization,
}: {
  id: string;
  audit: MetadataAuditResult;
  market: string;
  localization: string | undefined;
}) {
  const store = audit.store;
  const scope = useMemo(
    () => draftScopeOf(store, market, localization),
    [store, market, localization],
  );
  const live = useMemo(() => liveDraftValues(audit), [audit]);
  const draft = useListingDraft(id, scopeKey(scope), live);
  const request = useMemo(
    () => draftRequest(scope, draft.values, live),
    [scope, draft.values, live],
  );
  const preview = useCoveragePreview(id, request);
  const lint = preview.requested ? preview.query.data?.fields : undefined;
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const unchanged = draft.changed.length === 0;
  const fields = draftFieldsOf(store);

  const input = (field: ListingDraftField) => (
    <DraftFieldInput
      key={field}
      store={store}
      field={field}
      value={draft.values[field] ?? ""}
      onChange={(value) => draft.setField(field, value)}
      issues={lint?.find((entry) => entry.field === field)?.issues ?? []}
    />
  );

  return (
    <div className="grid grid-cols-12 items-start gap-6">
      <section
        aria-label="Draft listing"
        className="col-span-12 flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card px-4 pt-3 pb-4 @5xl/metadata:col-span-7"
      >
        {fields.filter((field) => field !== "description").map(input)}
        <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="-ml-2 w-fit">
              <ChevronRight
                aria-hidden
                className="transition-transform duration-150 ease-out data-[open=true]:rotate-90"
                data-open={descriptionOpen}
              />
              <span>Description</span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            {input("description")}
          </CollapsibleContent>
        </Collapsible>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            aria-disabled={unchanged || undefined}
            onClick={() => {
              if (!unchanged) draft.reset();
            }}
          >
            <RotateCcw aria-hidden />
            <span>Reset to live listing</span>
          </Button>
        </div>
      </section>
      <DraftCoveragePanel
        preview={preview}
        className="col-span-12 @5xl/metadata:col-span-5"
      />
    </div>
  );
}
