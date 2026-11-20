import { ArrowDown, ArrowUp, Minus } from "lucide-react";
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

const roundTo = (value: number, digits: number): number => {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
};

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
  if (value === null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const rounded = digits === undefined ? value : roundTo(value, digits);
  const written = (amount: number) =>
    digits === undefined ? String(amount) : amount.toFixed(digits);
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
      aria-label={`${way} ${magnitude}${unit} ${period}`}
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
  period = "since yesterday",
}: {
  value: number | null;
  period?: string;
}) {
  if (value === null || value === 0) return null;

  const way = direction(value, "lower-is-better");
  const Icon = GLYPH[way];
  const magnitude = Math.abs(value);

  return (
    <span
      role="img"
      aria-label={`${way} ${magnitude} ${period}`}
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
  if (value === null) {
    return labelled ? (
      <span className="text-label text-muted-foreground">{`no ${label} data`}</span>
    ) : (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">{`no ${label} data`}</span>
      </span>
    );
  }

  const rounded = roundTo(value, digits);
  const way = direction(rounded, "higher-is-better");
  const Icon = GLYPH[way];
  const shown = rounded.toFixed(digits);
  const signed = rounded > 0 ? `+${shown}` : shown;

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
        <span>{`${signed}${unit} ${label}`}</span>
      ) : (
        <>
          <span>{`${signed}${unit}`}</span>
          <span className="sr-only">{` ${label}`}</span>
        </>
      )}
    </span>
  );
}
