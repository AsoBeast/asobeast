"use client";

import { useId, useRef, useState } from "react";
import type { AppStoreLocalization } from "@asobeast/shared";
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
const SAVE_FOCUS = "targets:save";

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

function holdsOpen(targets: TargetEdits): boolean {
  const result = targets.read.data;
  if (!result || !hasSavedTargets(result)) return true;
  return (
    targets.edited ||
    targets.error !== null ||
    missingMarkets(result).length > 0 ||
    (targets.outcome !== null &&
      notTrackedSentence(targets.outcome.notTracked) !== null)
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
  const [open, setOpen] = useState(false);
  const close = () => {
    armFocusHandoff(EDIT_FOCUS);
    setOpen(false);
  };
  const targets = useTargetEdits(id, localization, (saved) => {
    if (notTrackedSentence(saved.notTracked) === null) close();
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
  const saveRef = useRef<HTMLButtonElement | null>(null);
  const claimSave = useFocusClaim(SAVE_FOCUS);
  const group = useFocusGroupClaim(OPEN_FOCUS, !editing);
  const focusSave = () => {
    if (saveRef.current) saveRef.current.focus();
    else armFocusHandoff(SAVE_FOCUS);
  };

  return (
    <section aria-labelledby={headingId} className="col-span-12 min-w-0">
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
                onFocusSave={focusSave}
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
            saveRef={(node) => {
              saveRef.current = node;
              claimSave(node);
            }}
            firstSlot={() =>
              group.current?.querySelector<HTMLElement>("button") ?? null
            }
            onDone={held ? undefined : close}
          />
        ) : null}
      </Card>
    </section>
  );
}
