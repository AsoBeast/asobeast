import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { formatFixedNumberInLocale, roundAsShown } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";

export type DeltaPolarity = "higher-is-better" | "lower-is-better";

type Direction = "up" | "down" | "flat";

const GLYPH: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus,
};

const TONE: Record<Direction, string> = {
  up: "text-signal-up",
  down: "text-signal-down",
  flat: "text-muted-foreground",
};

const PILL: Record<Direction, string> = {
  up: "bg-signal-up-subtle",
  down: "bg-signal-down-subtle",
  flat: "bg-secondary",
};

const ARROW_LIFT = "-translate-y-[0.07em]";

export type DeltaForm = "text" | "pill";

const PILL_SHAPE = "h-[22px] rounded-md px-[7px] text-label";

const formOf = (way: Direction, form: DeltaForm) =>
  form === "pill" ? cn(PILL_SHAPE, PILL[way]) : undefined;

const slotOf = (form: DeltaForm) =>
  form === "pill" ? "delta-pill" : undefined;

function direction(value: number, polarity: DeltaPolarity): Direction {
  if (value === 0) return "flat";
  const improved = polarity === "lower-is-better" ? value < 0 : value > 0;
  return improved ? "up" : "down";
}

export function DirectionArrow({
  way,
  className,
}: {
  way: "up" | "down";
  className?: string;
}) {
  const Icon = GLYPH[way];
  return (
    <Icon
      className={cn("size-3.5 shrink-0", ARROW_LIFT, className)}
      aria-hidden
    />
  );
}

export function DeltaChip({
  value,
  polarity = "lower-is-better",
  period,
  unit = "",
  digits,
  form = "text",
  className,
}: {
  value: number | null;
  polarity?: DeltaPolarity;
  period: string;
  unit?: string;
  digits?: number;
  form?: DeltaForm;
  className?: string;
}) {
  const locale = useAppLocale();
  const t = useTranslations("format");
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const rounded = digits === undefined ? value : roundAsShown(value, digits);
  const written = (amount: number) =>
    digits === undefined
      ? String(amount)
      : formatFixedNumberInLocale(amount, digits, locale);
  if (rounded === 0) {
    return (
      <span
        data-slot={slotOf(form)}
        className={cn(
          "numeric text-muted-foreground",
          formOf("flat", form),
          className,
        )}
      >
        {written(0)}
      </span>
    );
  }

  const way = direction(rounded, polarity);
  const Icon = GLYPH[way];
  const magnitude = written(Math.abs(rounded));

  return (
    <span
      data-slot={slotOf(form)}
      role="img"
      aria-label={t("deltaLabel", {
        direction: t(`direction.${way}`),
        magnitude,
        unit,
        period,
      })}
      className={cn(
        "numeric inline-flex items-center gap-0.5 font-medium",
        TONE[way],
        formOf(way, form),
        className,
      )}
    >
      <Icon className={cn("size-3.5", ARROW_LIFT)} aria-hidden />
      <span>{`${magnitude}${unit}`}</span>
    </span>
  );
}

export function PositionDeltaChip({
  value,
  period,
}: {
  value: number | null;
  period?: string;
}) {
  const t = useTranslations("format");
  const label = period ?? t("positionSinceYesterday");
  if (value === null || value === 0) return null;

  const way = direction(value, "lower-is-better");
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      role="img"
      aria-label={t("positionDeltaLabel", {
        direction: t(`direction.${way}`),
        magnitude,
        period: label,
      })}
      className={cn(
        "numeric inline-flex items-center gap-0.5 text-label font-medium",
        TONE[way],
      )}
    >
      <Icon className={cn("size-3", ARROW_LIFT)} aria-hidden />
      <span>{magnitude}</span>
    </span>
  );
}

export function TrendChip({
  label,
  value,
  unit = "",
  digits = 0,
  form = "text",
  labelled = true,
}: {
  label: string;
  value: number | null;
  unit?: string;
  digits?: number;
  form?: DeltaForm;
  labelled?: boolean;
}) {
  const locale = useAppLocale();
  const t = useTranslations("format");
  if (value === null) {
    const missing = t("noData", { label });
    return labelled ? (
      <span className="text-label text-muted-foreground">{missing}</span>
    ) : (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">{missing}</span>
      </span>
    );
  }

  const rounded = roundAsShown(value, digits);
  const way = direction(rounded, "higher-is-better");
  const Icon = GLYPH[way];
  const shown = formatFixedNumberInLocale(rounded, digits, locale);

  return (
    <span
      data-slot={slotOf(form)}
      className={cn(
        "numeric inline-flex items-center gap-0.5 text-label font-medium",
        TONE[way],
        formOf(way, form),
      )}
    >
      <Icon className={cn("size-3.5", ARROW_LIFT)} aria-hidden />
      {labelled ? (
        <span>
          {t("trendValue", {
            value: `${rounded > 0 ? "+" : ""}${shown}${unit}`,
            label,
          })}
        </span>
      ) : (
        <>
          <span>{`${rounded > 0 ? "+" : ""}${shown}${unit}`}</span>
          <span className="sr-only">{t("trendPeriod", { label })}</span>
        </>
      )}
    </span>
  );
}
