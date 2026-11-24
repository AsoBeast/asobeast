"use client";

import { useMemo, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import type { MetadataAuditResult } from "@asobeast/shared";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { StoreFieldNotice } from "@/components/localizations/KeywordFieldEditor";
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
import { CopyDraftButton, CopyFieldButton } from "./CopyDraftButtons";
import { DraftCoveragePanel } from "./DraftCoveragePanel";
import { useDraftFieldReveal } from "./draft-field-reveal";
import { DraftFieldInput } from "./DraftFieldInput";
import { KeywordFieldHandoff } from "./KeywordFieldHandoff";
import {
  useDraftKeywordField,
  type DraftKeywordField,
} from "./use-draft-keyword-field";
import { useCoveragePreview } from "./use-coverage-preview";
import { useListingDraft } from "./use-listing-draft";

function KeywordFieldNotice({ field }: { field: DraftKeywordField }) {
  if (field.managed) return <StoreFieldNotice sync={field.sync} />;
  if (field.settled || !field.read.isError) return null;
  return (
    <InlineQueryError
      message="Could not read whether App Store Connect manages this keyword field."
      read={field.read}
    />
  );
}

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
  const field = useDraftKeywordField(id, scope);
  const values = useMemo(
    () =>
      field.managed
        ? { ...draft.values, keywordField: live.keywordField }
        : draft.values,
    [field.managed, draft.values, live],
  );
  const request = useMemo(
    () => draftRequest(scope, values, live),
    [scope, values, live],
  );
  const preview = useCoveragePreview(id, request);
  const lint = preview.requested ? preview.query.data?.fields : undefined;
  const revealDescription = useDraftFieldReveal("description");
  const [descriptionOpen, setDescriptionOpen] = useState(revealDescription);
  if (revealDescription && !descriptionOpen) setDescriptionOpen(true);
  const unchanged = request === null;
  const handsOff =
    field.handoff !== null &&
    !field.managed &&
    draft.changed.includes("keywordField");
  const fields = draftFieldsOf(store);
  const locked = field.managed || !field.settled;

  const input = (name: ListingDraftField) => (
    <DraftFieldInput
      key={name}
      store={store}
      field={name}
      value={values[name] ?? ""}
      onChange={(value) => draft.setField(name, value)}
      readOnly={name === "keywordField" && locked}
      action={<CopyFieldButton field={name} value={values[name] ?? ""} />}
      issues={lint?.find((entry) => entry.field === name)?.issues ?? []}
    >
      {name === "keywordField" ? <KeywordFieldNotice field={field} /> : null}
      {name === "keywordField" && handsOff && field.handoff ? (
        <KeywordFieldHandoff localization={field.handoff} />
      ) : null}
    </DraftFieldInput>
  );

  return (
    <div className="grid grid-cols-12 items-start gap-6">
      <section
        aria-label="Draft listing"
        className="col-span-12 flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card px-4 pt-3 pb-4 @5xl/metadata:col-span-7"
      >
        {fields.filter((name) => name !== "description").map(input)}
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
          <CopyDraftButton store={store} values={values} />
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
