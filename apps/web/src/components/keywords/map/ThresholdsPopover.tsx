"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  parseThresholdInput,
  ZONE_THRESHOLD_MAX,
  ZONE_THRESHOLD_MIN,
  zoneRule,
  type ZoneThresholds,
} from "@/lib/keyword-zones";
import { useZoneThresholds } from "../use-zone-thresholds";
import { useAppLocale } from "@/lib/use-app-locale";

function ThresholdField({
  label,
  value,
  onValid,
}: {
  label: string;
  value: number;
  onValid: (next: number) => void;
}) {
  const id = useId();
  const errorId = useId();
  const t = useTranslations("keywordInspector");
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseThresholdInput(draft) === null;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={ZONE_THRESHOLD_MIN}
        max={ZONE_THRESHOLD_MAX}
        step={1}
        value={draft ?? String(value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          const next = parseThresholdInput(event.target.value);
          if (next !== null) onValid(next);
        }}
        onBlur={() => setDraft(null)}
      />
      <div className="min-h-lh text-caption">
        {invalid ? (
          <p id={errorId} role="alert" className="text-destructive">
            {t("thresholds.invalid", {
              min: ZONE_THRESHOLD_MIN,
              max: ZONE_THRESHOLD_MAX,
            })}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ThresholdsPopover() {
  const titleId = useId();
  const t = useTranslations("keywordInspector");
  const keywords = useTranslations("keywords");
  const locale = useAppLocale();
  const { thresholds, setThresholds, resetThresholds, isDefault } =
    useZoneThresholds();
  const update = (field: keyof ZoneThresholds) => (next: number) =>
    setThresholds({ ...thresholds, [field]: next });
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="print:hidden">
          <SlidersHorizontal aria-hidden />
          <span>{t("thresholds.trigger")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={titleId}
        align="end"
        collisionPadding={16}
        className="flex w-80 max-w-(--radix-popover-content-available-width) flex-col gap-3 text-body"
      >
        <div className="flex items-start justify-between gap-3">
          <PopoverHeader>
            <PopoverTitle id={titleId}>{t("thresholds.title")}</PopoverTitle>
            <PopoverDescription>
              {t("thresholds.description")}
            </PopoverDescription>
          </PopoverHeader>
          <Button
            variant="outline"
            size="sm"
            aria-disabled={isDefault || undefined}
            onClick={() => {
              if (!isDefault) resetThresholds();
            }}
          >
            {t("thresholds.reset")}
          </Button>
        </div>
        <ThresholdField
          label={t("thresholds.popularity")}
          value={thresholds.popularity}
          onValid={update("popularity")}
        />
        <ThresholdField
          label={t("thresholds.difficulty")}
          value={thresholds.difficulty}
          onValid={update("difficulty")}
        />
        <p className="text-caption text-muted-foreground">
          {t("thresholds.quickWins", {
            rule:
              locale === "en"
                ? zoneRule("quickWins", thresholds, keywords).toLowerCase()
                : zoneRule("quickWins", thresholds, keywords),
          })}
        </p>
      </PopoverContent>
    </Popover>
  );
}
