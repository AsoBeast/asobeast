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
import { topThreeRefusal, withTopThree } from "@/lib/listing-targets";
import { localizationName } from "@/lib/localizations";
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
  const refusal = result
    ? topThreeRefusal(targets.slots, result.candidates)
    : null;

  return (
    <section aria-labelledby={headingId} className="col-span-12 min-w-0">
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>
              {`Targets for ${localizationName(localization)}`}
            </h2>
          </CardTitle>
          <CardAction className="flex items-center gap-2">
            {result ? (
              <Button
                variant="outline"
                size="sm"
                aria-disabled={refusal !== null || undefined}
                title={refusal ?? undefined}
                onClick={() => {
                  if (refusal !== null) return;
                  targets.edit(withTopThree(targets.slots, result.candidates));
                  saveRef.current?.focus();
                }}
              >
                <span>Use top 3</span>
              </Button>
            ) : null}
            <TargetsTip />
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
