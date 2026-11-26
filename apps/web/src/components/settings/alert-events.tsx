"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";
import {
  RATING_DROP_TENTHS_CHOICES,
  REVIEW_SCORES,
  type ReviewScore,
} from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MessageTranslator } from "@/i18n/translator";
import { parseRankDropThreshold, ratingDropOption } from "./alert-thresholds";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export { ratingDropOption } from "./alert-thresholds";

function ToggleChip({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <Button
      type="button"
      role="checkbox"
      aria-checked={checked}
      variant={checked ? "default" : "outline"}
      size="sm"
      onClick={onClick}
    >
      <CheckIcon className={checked ? undefined : "invisible"} />
      {children}
    </Button>
  );
}

export function reviewStarOption(
  score: number,
  translator: MessageTranslator,
): string {
  return translator("reviewStars.option", { score });
}

export function ReviewStarSelection({
  value,
  onChange,
}: {
  value: readonly number[];
  onChange: (next: number[]) => void;
}) {
  const t = useTranslations("notifications");
  const labelId = useId();
  const helpId = useId();

  function toggle(score: ReviewScore) {
    onChange(
      value.includes(score)
        ? value.filter((item) => item !== score)
        : [...value, score].sort((left, right) => left - right),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Label id={labelId}>{t("reviewStars.label")}</Label>
      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={helpId}
        className="flex flex-wrap gap-2"
      >
        {REVIEW_SCORES.map((score) => (
          <ToggleChip
            key={score}
            checked={value.includes(score)}
            onClick={() => toggle(score)}
          >
            {reviewStarOption(score, t)}
          </ToggleChip>
        ))}
      </div>
      <p id={helpId} className="text-caption text-muted-foreground">
        {value.length === 0 ? t("reviewStars.required") : t("reviewStars.help")}
      </p>
    </div>
  );
}

const ratingDropChoices = (value: number): number[] =>
  [...new Set<number>([...RATING_DROP_TENTHS_CHOICES, value])].sort(
    (left, right) => left - right,
  );

export function RatingDropSelection({
  value,
  onChange,
}: {
  value: number;
  onChange: (next: number) => void;
}) {
  const t = useTranslations("notifications");
  const triggerId = useId();
  const helpId = useId();

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={triggerId}>{t("ratingDrop.label")}</Label>
      <Select
        value={String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger
          id={triggerId}
          aria-describedby={helpId}
          className="w-[160px]"
        >
          <SelectValue>{ratingDropOption(value, t)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {ratingDropChoices(value).map((tenths) => (
            <SelectItem key={tenths} value={String(tenths)}>
              {ratingDropOption(tenths, t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p id={helpId} className="text-caption text-muted-foreground">
        {t("ratingDrop.help")}
      </p>
    </div>
  );
}

const rankHelp = (
  instance: number | null,
  translator: MessageTranslator,
): string =>
  instance === null
    ? translator("rankDrop.helpDefault")
    : translator("rankDrop.helpInstance", { instance });

export function RankDropField({
  value,
  onChange,
  instance,
}: {
  value: string;
  onChange: (next: string) => void;
  instance: number | null;
}) {
  const t = useTranslations("notifications");
  const validation = useTranslations("validation");
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();
  const { error } = parseRankDropThreshold(value, validation);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>{t("rankDrop.label")}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={value}
          placeholder={instance === null ? undefined : String(instance)}
          aria-invalid={error !== null}
          aria-describedby={error ? `${errorId} ${helpId}` : helpId}
          className="w-24"
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="text-dense text-muted-foreground">
          {t("rankDrop.positions")}
        </span>
      </div>
      {error ? (
        <p id={errorId} className="text-dense text-destructive">
          {error}
        </p>
      ) : null}
      <p id={helpId} className="text-caption text-muted-foreground">
        {rankHelp(instance, t)}
      </p>
    </div>
  );
}
