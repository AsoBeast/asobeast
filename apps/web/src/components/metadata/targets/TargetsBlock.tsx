"use client";

import { useId, useState } from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import type { AppStoreLocalization } from "@asobeast/shared";
import { InlineQueryError } from "@/components/layout/InlineQueryError";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { readersLine } from "@/lib/listing-targets";
import { localizationName } from "@/lib/localizations";
import { TargetSlotList } from "./TargetSlotList";
import { useTargetEdits } from "./use-target-edits";

const ROLE_SLOTS = [0, 1, 2] as const;
const MORE_SLOTS = [3, 4, 5, 6, 7, 8, 9] as const;

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
  const result = targets.read.data;
  const showMore =
    more ?? MORE_SLOTS.some((index) => targets.slots[index] !== null);
  const idle = !targets.edited || targets.saving;

  return (
    <section aria-labelledby={headingId} className="col-span-12 min-w-0">
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>
              {`Targets for ${localizationName(localization)}`}
            </h2>
          </CardTitle>
          <CardAction>
            <TargetsTip />
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {result ? (
            <>
              <TargetSlotList
                label="Title and subtitle"
                indexes={ROLE_SLOTS}
                slots={targets.slots}
                result={result}
                onEdit={targets.edit}
                className="rounded-md bg-brand-subtle"
              />
              <Button
                variant="ghost"
                size="sm"
                aria-expanded={showMore}
                className="-ml-2 w-fit"
                onClick={() => setMore(!showMore)}
              >
                <ChevronRight
                  aria-hidden
                  className="transition-transform duration-150 ease-out data-[open=true]:rotate-90"
                  data-open={showMore}
                />
                <span>{showMore ? "Show fewer slots" : "Show more slots"}</span>
              </Button>
              {showMore ? (
                <TargetSlotList
                  label="More keywords"
                  indexes={MORE_SLOTS}
                  slots={targets.slots}
                  result={result}
                  onEdit={targets.edit}
                />
              ) : null}
            </>
          ) : targets.read.isError ? (
            <InlineQueryError
              message="Could not load the target keywords."
              read={targets.read}
            />
          ) : (
            <p className="text-dense text-muted-foreground">
              Reading the target keywords…
            </p>
          )}
          {targets.error ? (
            <p role="alert" className="text-dense text-destructive">
              {targets.error}
            </p>
          ) : null}
        </CardContent>
        <CardFooter className="flex-wrap justify-between">
          <span>{result ? readersLine(result.readers) : ""}</span>
          <span className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              aria-disabled={idle || undefined}
              onClick={() => {
                if (!idle) targets.discard();
              }}
            >
              <RotateCcw aria-hidden />
              <span>Discard changes</span>
            </Button>
            <Button
              aria-disabled={idle || undefined}
              onClick={() => {
                if (!idle) targets.save();
              }}
            >
              Save targets
            </Button>
          </span>
        </CardFooter>
      </Card>
    </section>
  );
}
