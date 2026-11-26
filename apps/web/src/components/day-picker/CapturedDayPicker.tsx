"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { addUtcDays } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { cn } from "@/lib/utils";
import {
  monthLabel,
  monthOf,
  monthWeeks,
  shiftMonth,
  type Month,
} from "./calendar-grid";
import { stepDate } from "./step-date";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

function capturedNear(
  dates: readonly string[],
  from: string,
  step: number,
): string | null {
  const wanted = addUtcDays(from, step);
  return dates.includes(wanted)
    ? wanted
    : stepDate(dates, wanted, step > 0 ? 1 : -1);
}

function nearestCaptured(dates: readonly string[], date: string): string {
  if (dates.includes(date)) return date;
  return stepDate(dates, date, -1) ?? stepDate(dates, date, 1) ?? date;
}

function firstCapturedIn(
  dates: readonly string[],
  { year, month }: Month,
): string | undefined {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`;
  return [...dates].sort().find((date) => date.startsWith(prefix));
}

function DayGrid({
  dates,
  value,
  onSelect,
}: {
  dates: readonly string[];
  value: string;
  onSelect: (date: string) => void;
}) {
  const locale = useAppLocale();
  const t = useTranslations("datePicker");
  const start = nearestCaptured(dates, value);
  const [month, setMonth] = useState(() => monthOf(start));
  const [focused, setFocused] = useState(start);
  const pendingFocus = useRef(true);
  const grid = useRef<HTMLDivElement>(null);
  const captured = useMemo(() => new Set(dates), [dates]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    pendingFocus.current = false;
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)
      ?.focus();
  }, [focused, month]);

  const showMonth = (next: Month) => {
    setMonth(next);
    const first = firstCapturedIn(dates, next);
    if (first) setFocused(first);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = KEY_STEPS[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = capturedNear(dates, focused, step);
    if (!next) return;
    pendingFocus.current = true;
    setMonth(monthOf(next));
    setFocused(next);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          data-action="previous-month"
          aria-label={t("previousMonth")}
          onClick={() => showMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-body font-medium" aria-live="polite">
          {monthLabel(month, locale)}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          data-action="next-month"
          aria-label={t("nextMonth")}
          onClick={() => showMonth(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={monthLabel(month, locale)}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              role="columnheader"
              aria-label={t(`weekdays.long.${weekday}`)}
              className="text-center text-caption text-muted-foreground"
            >
              {t(`weekdays.short.${weekday}`)}
            </span>
          ))}
        </div>
        {monthWeeks(month).map((week, index) => (
          <div key={index} role="row" className="grid grid-cols-7 gap-1">
            {week.map(({ date, weekday }) => (
              <div key={weekday} role="gridcell" className="size-9">
                {date ? (
                  <button
                    type="button"
                    data-date={date}
                    data-captured={captured.has(date) || undefined}
                    aria-label={formatDateInLocale(date, locale)}
                    aria-pressed={date === value}
                    disabled={!captured.has(date)}
                    tabIndex={date === focused ? 0 : -1}
                    onClick={() => onSelect(date)}
                    className={cn(
                      "numeric size-9 rounded-md text-dense text-muted-foreground disabled:cursor-not-allowed",
                      date === value
                        ? "bg-brand-subtle font-medium text-brand-text"
                        : "data-captured:bg-secondary data-captured:text-foreground data-captured:hover:bg-accent",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-1 focus-visible:outline-ring",
                    )}
                  >
                    {Number(date.slice(-2))}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CapturedDayPicker({
  dates,
  value,
  onSelect,
}: {
  dates: readonly string[];
  value: string | null;
  onSelect: (date: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const locale = useAppLocale();
  const t = useTranslations("datePicker");
  const anchor = value ?? dates[0] ?? null;
  const previous = value ? stepDate(dates, value, -1) : null;
  const next = value ? stepDate(dates, value, 1) : null;
  const pick = (date: string) => {
    setOpen(false);
    onSelect(date);
  };

  return (
    <div data-slot="captured-day-picker" className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={
              value
                ? t("capturedDayValue", {
                    date: formatDateInLocale(value, locale),
                  })
                : t("capturedDay")
            }
            disabled={anchor === null}
            className="min-w-36 justify-start"
          >
            <CalendarDays aria-hidden />
            {value ? formatDateInLocale(value, locale) : t("noCaptureYet")}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label={t("chooseCapturedDay")}
          className="w-auto"
        >
          {anchor ? (
            <DayGrid dates={dates} value={anchor} onSelect={pick} />
          ) : null}
        </PopoverContent>
      </Popover>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("previousCapturedDay")}
        aria-disabled={previous === null || undefined}
        onClick={() => {
          if (previous) onSelect(previous);
        }}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label={t("nextCapturedDay")}
        aria-disabled={next === null || undefined}
        onClick={() => {
          if (next) onSelect(next);
        }}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
