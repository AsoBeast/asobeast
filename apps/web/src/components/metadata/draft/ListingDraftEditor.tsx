"use client";

import { useEffect, useMemo, useState } from "react";
import type { DefaultingListing, MetadataAuditResult } from "@asobeast/shared";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { StoreFieldNotice } from "@/components/localizations/KeywordFieldEditor";
import {
  changedFields,
  draftFieldsOf,
  draftRequest,
  adoptHomeDraft,
  draftScopeOf,
  fieldCount,
  liveDraftValues,
  scopeKey,
  type ListingDraftField,
} from "@/lib/listing-draft";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { searchWords } from "@/lib/store-preview/search-words";
import { CopyFieldButton } from "./CopyDraftButtons";
import type { DensityContext } from "../density/density-inputs";
import { DescriptionDensity } from "../density/DescriptionDensity";
import { TargetsBlock } from "../targets/TargetsBlock";
import { coverageVerdict } from "./coverage-verdict";
import { DescriptionFold } from "./DescriptionFold";
import { DraftCoveragePanel } from "./DraftCoveragePanel";
import { useDraftFieldReveal } from "./draft-field-reveal";
import { DraftFieldInput, draftFieldSelector } from "./DraftFieldInput";
import { DraftFieldsCard } from "./DraftFieldsCard";
import { DraftStorePreview } from "./DraftStorePreview";
import { DraftVerdictStrip } from "./DraftVerdict";
import { KeywordFieldHandoff } from "./KeywordFieldHandoff";
import { RemoveRepeatsButton } from "./RemoveRepeatsButton";
import { undoToast } from "./undo-toast";
import {
  useDraftKeywordField,
  type DraftKeywordField,
} from "./use-draft-keyword-field";
import { useCoveragePreview, useTargetedRequest } from "./use-coverage-preview";
import { useListingDraft } from "./use-listing-draft";

const DRAFT_RAIL =
  "col-span-12 flex min-w-0 flex-col gap-6 @4xl/metadata:sticky @4xl/metadata:top-20 @4xl/metadata:col-span-5";

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
  app,
  market,
  localization,
  density,
}: {
  id: string;
  audit: MetadataAuditResult;
  app: DefaultingListing;
  market: string;
  localization: string | undefined;
  density: DensityContext;
}) {
  const store = audit.store;
  const { country, defaultLocalization } = app;
  useEffect(() => {
    if (market === country && localization === undefined) {
      adoptHomeDraft(id, { country, defaultLocalization });
    }
  }, [id, market, localization, country, defaultLocalization]);
  const scope = useMemo(
    () =>
      draftScopeOf(store, market, localization, {
        country,
        defaultLocalization,
      }),
    [store, market, localization, country, defaultLocalization],
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
  const preview = useCoveragePreview(
    id,
    useTargetedRequest(id, scope, request),
  );
  const answer = preview.requested ? preview.query.data : undefined;
  const current = !preview.settling && !preview.query.isPlaceholderData;
  const wasted = current ? (answer?.wastedWords ?? []) : [];
  const revealDescription = useDraftFieldReveal("description");
  const [descriptionOpen, setDescriptionOpen] = useState(revealDescription);
  if (revealDescription && !descriptionOpen) setDescriptionOpen(true);
  const changed = changedFields(values, live).length;
  const handsOff =
    field.handoff !== null &&
    !field.managed &&
    draft.changed.includes("keywordField");
  const fields = draftFieldsOf(store);
  const locked = field.managed || !field.settled;
  const valueOf = (name: ListingDraftField) => values[name] ?? "";
  const liveOf = (name: ListingDraftField) => live[name] ?? "";
  const issuesOf = (name: ListingDraftField) =>
    answer?.fields.find((entry) => entry.field === name)?.issues ?? [];

  const revert = (name: ListingDraftField) => {
    const before = valueOf(name);
    draft.setField(name, liveOf(name));
    document.querySelector<HTMLElement>(draftFieldSelector(name))?.focus();
    undoToast(
      `${METADATA_FIELD_LABELS[name]} reverted to the live listing`,
      () => draft.setField(name, before),
    );
  };

  const input = (name: ListingDraftField) => (
    <DraftFieldInput
      key={name}
      store={store}
      field={name}
      value={valueOf(name)}
      live={liveOf(name)}
      onChange={(value) => draft.setField(name, value)}
      onRevert={() => revert(name)}
      readOnly={name === "keywordField" && locked}
      hideLabel={name === "description"}
      action={<CopyFieldButton field={name} value={valueOf(name)} />}
      issues={issuesOf(name)}
      words={searchWords(store, name, valueOf(name), wasted)}
    >
      {name === "keywordField" ? <KeywordFieldNotice field={field} /> : null}
      {name === "keywordField" && !locked && current ? (
        <RemoveRepeatsButton
          value={valueOf(name)}
          issues={issuesOf(name)}
          onChange={(value) => draft.setField(name, value)}
        />
      ) : null}
      {name === "keywordField" && handsOff && field.handoff ? (
        <KeywordFieldHandoff localization={field.handoff} />
      ) : null}
      {name === "description" ? (
        <DescriptionDensity
          text={values.description ?? ""}
          title={values.title ?? null}
          context={density}
          level="h3"
        />
      ) : null}
    </DraftFieldInput>
  );

  return (
    <div className="grid grid-cols-12 items-start gap-6">
      {scope.store === "APP_STORE" ? (
        <TargetsBlock
          key={scope.localization}
          id={id}
          localization={scope.localization}
        />
      ) : null}
      <DraftVerdictStrip verdict={answer ? coverageVerdict(answer) : null} />
      <DraftFieldsCard
        store={store}
        values={values}
        changed={changed}
        onReset={draft.reset}
      >
        {fields.filter((name) => name !== "description").map(input)}
        <DescriptionFold
          open={descriptionOpen}
          onOpenChange={setDescriptionOpen}
          count={fieldCount(store, "description", valueOf("description")).text}
          changed={valueOf("description") !== liveOf("description")}
        >
          {input("description")}
        </DescriptionFold>
      </DraftFieldsCard>
      <div className={DRAFT_RAIL}>
        <DraftCoveragePanel preview={preview} />
        <DraftStorePreview
          id={id}
          values={values}
          localization={localization}
          className="min-w-0"
        />
      </div>
    </div>
  );
}
