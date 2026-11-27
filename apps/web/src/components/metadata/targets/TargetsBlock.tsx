"use client";

import { useId, useRef, useState } from "react";
import type { AppStoreLocalization } from "@asobeast/shared";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { localizationName } from "@/lib/localizations";
import { cn } from "@/lib/utils";
import { TargetsActions } from "./TargetsActions";
import { MORE_SLOTS, ROLE_SLOTS, TargetsBody } from "./TargetsBody";
import { TargetsFooter } from "./TargetsFooter";
import { TargetsLimitNotice } from "./TargetsLimitNotice";
import { useTargetEdits } from "./use-target-edits";

function TargetsTip() {
  return (
    <InfoTip
      label="About target keywords"
      title="What a target keyword is"
      summary="A target is a phrase this localization should rank for. Slot 1 is meant for the title and slots 2 and 3 for the subtitle. Picking one you do not track yet tracks it in every market that reads this localization."
    >
      <a
        href="https://docs.asobeast.com/concepts/countries#target-keywords-of-a-localization"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read about target keywords
      </a>
    </InfoTip>
  );
}

function SuggestionsTip() {
  return (
    <InfoTip
      label="About suggested fields"
      title="Suggested fields"
      summary="Each target and candidate names the field its scores suggest: the title for the strongest keyword you can realistically rank for, the subtitle for the next two, the keyword field for the rest, or skip. It is worked out from stored scores, and each candidate is judged as if you added it."
    >
      <a
        href="https://docs.asobeast.com/concepts/scoring#where-does-each-keyword-belong"
        target="_blank"
        rel="noreferrer"
        className="font-medium text-foreground link-underline"
      >
        Read how suggestions are made
      </a>
    </InfoTip>
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
  const targets = useTargetEdits(id, localization);
  const [more, setMore] = useState<boolean | null>(null);
  const [moved, setMoved] = useState("");
  const announceMove = (sentence: string, to: number) => {
    setMoved(sentence);
    if (to >= ROLE_SLOTS.length) setMore(true);
  };
  const result = targets.read.data;
  const showMore =
    more ?? MORE_SLOTS.some((index) => targets.slots[index] !== null);
  const saveRef = useRef<HTMLButtonElement>(null);

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
            {result ? (
              <TargetsActions
                slots={targets.slots}
                result={result}
                onEdit={targets.edit}
                onApplied={setMoved}
                saveRef={saveRef}
              />
            ) : null}
            <TargetsTip />
            <SuggestionsTip />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <TargetsBody
            targets={targets}
            showMore={showMore}
            onToggleMore={() => setMore(!showMore)}
            onMoved={announceMove}
          />
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
        <TargetsFooter targets={targets} result={result} saveRef={saveRef} />
      </Card>
    </section>
  );
}
