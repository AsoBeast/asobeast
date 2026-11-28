"use client";

import { useEffect, useId, useRef, useState } from "react";
import type {
  AppStoreLocalization,
  ListingTargetsResult,
  ListingTargetsSaveResult,
} from "@asobeast/shared";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import {
  armFocusHandoff,
  focusIsLost,
  useFocusAfterCommit,
  useFocusClaim,
  useFocusGroupClaim,
} from "@/lib/focus-handoff";
import {
  hasSavedTargets,
  missingMarkets,
  notTrackedSentence,
} from "@/lib/listing-targets";
import { localizationName } from "@/lib/localizations";
import { cn } from "@/lib/utils";
import { SavedTargets } from "./SavedTargets";
import { TargetsActions } from "./TargetsActions";
import { MORE_SLOTS, ROLE_SLOTS, TargetsBody } from "./TargetsBody";
import { TargetsFooter } from "./TargetsFooter";
import { TargetsLimitNotice } from "./TargetsLimitNotice";
import { useTargetEdits, type TargetEdits } from "./use-target-edits";

const EDIT_FOCUS = "targets:edit";
const OPEN_FOCUS = "targets:open";

const DOC_LINK = "font-medium text-foreground link-underline";

function TargetsTip() {
  return (
    <InfoTip
      label="About target keywords"
      title="Targets and suggested fields"
      summary="A target is a phrase this localization should rank for: slot 1 for the title, slots 2 and 3 for the subtitle. Each target and candidate names the field its stored scores suggest. Picking a phrase you do not track yet tracks it in every market that reads this localization."
    >
      <a
        href="https://docs.asobeast.com/concepts/countries#target-keywords-of-a-localization"
        target="_blank"
        rel="noreferrer"
        className={DOC_LINK}
      >
        Read about target keywords
      </a>
      <a
        href="https://docs.asobeast.com/concepts/scoring#where-does-each-keyword-belong"
        target="_blank"
        rel="noreferrer"
        className={DOC_LINK}
      >
        Read how suggestions are made
      </a>
    </InfoTip>
  );
}

function needsEditor(
  result: ListingTargetsResult,
  outcome: ListingTargetsSaveResult | null,
): boolean {
  return (
    !hasSavedTargets(result) ||
    missingMarkets(result).length > 0 ||
    (outcome !== null && notTrackedSentence(outcome.notTracked) !== null)
  );
}

function holdsOpen(targets: TargetEdits): boolean {
  const result = targets.read.data;
  if (!result) return true;
  return (
    targets.edited ||
    targets.error !== null ||
    needsEditor(result, targets.outcome)
  );
}

function EditTargetsButton({ onOpen }: { onOpen: () => void }) {
  const claim = useFocusClaim(EDIT_FOCUS);
  return (
    <Button
      ref={claim}
      variant="outline"
      size="sm"
      onClick={() => {
        armFocusHandoff(OPEN_FOCUS);
        onOpen();
      }}
    >
      <span>Edit targets</span>
    </Button>
  );
}

export function TargetsBlock({
  id,
  localization,
}: {
  id: string;
  localization: AppStoreLocalization;
}) {
  const headingId = useId();
  const sectionRef = useRef<HTMLElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const saveFocusPending = useRef(false);
  const focusAfter = useFocusAfterCommit();
  const [open, setOpen] = useState(false);
  const firstSlot = () =>
    sectionRef.current?.querySelector<HTMLElement>("ul button") ?? null;
  const close = () => {
    armFocusHandoff(EDIT_FOCUS);
    setOpen(false);
  };
  const targets = useTargetEdits(id, localization, (saved) => {
    const active = document.activeElement;
    const focusHere =
      focusIsLost() || (sectionRef.current?.contains(active) ?? false);
    if (needsEditor(saved, saved)) {
      if (focusHere && active instanceof HTMLElement) {
        focusAfter(firstSlot(), active);
      }
      return;
    }
    if (focusHere) armFocusHandoff(EDIT_FOCUS);
    setOpen(false);
  });
  useEffect(() => {
    if (!saveFocusPending.current) return;
    saveFocusPending.current = false;
    saveRef.current?.focus();
  });
  const [more, setMore] = useState<boolean | null>(null);
  const [moved, setMoved] = useState("");
  const announceMove = (sentence: string, to: number) => {
    setMoved(sentence);
    if (to >= ROLE_SLOTS.length) setMore(true);
  };
  const result = targets.read.data;
  const held = holdsOpen(targets);
  const editing = open || held;
  const showMore =
    more ?? MORE_SLOTS.some((index) => targets.slots[index] !== null);
  const group = useFocusGroupClaim(OPEN_FOCUS, !editing);

  return (
    <section
      ref={sectionRef}
      aria-labelledby={headingId}
      className="col-span-12 min-w-0"
    >
      <Card>
        <CardHeader
          className={cn(PANEL_HEADER, "@max-lg/card-header:grid-cols-1")}
        >
          <CardTitle asChild>
            <h2 id={headingId}>
              {`Targets for ${localizationName(localization)}`}
            </h2>
          </CardTitle>
          <CardAction className="flex flex-wrap items-center justify-end gap-2 @max-lg/card-header:col-start-1 @max-lg/card-header:row-start-2 @max-lg/card-header:justify-self-start @max-lg/card-header:justify-start">
            {!editing ? (
              <EditTargetsButton onOpen={() => setOpen(true)} />
            ) : null}
            {editing && result ? (
              <TargetsActions
                slots={targets.slots}
                result={result}
                onEdit={targets.edit}
                onApplied={setMoved}
                onFocusSave={() => {
                  saveFocusPending.current = true;
                }}
              />
            ) : null}
            <TargetsTip />
          </CardAction>
        </CardHeader>
        <CardContent ref={group} className="flex flex-col gap-2">
          {editing ? (
            <TargetsBody
              targets={targets}
              showMore={showMore}
              onToggleMore={() => setMore(!showMore)}
              onMoved={announceMove}
            />
          ) : (
            <SavedTargets slots={targets.slots} />
          )}
          <p role="status" className="sr-only">
            {moved}
          </p>
          <TargetsLimitNotice outcome={targets.outcome} />
          {targets.error ? (
            <p role="alert" className="text-dense text-destructive">
              {targets.error}
            </p>
          ) : null}
        </CardContent>
        {editing ? (
          <TargetsFooter
            targets={targets}
            result={result}
            saveRef={saveRef}
            firstSlot={firstSlot}
            onDone={held ? undefined : close}
          />
        ) : null}
      </Card>
    </section>
  );
}
