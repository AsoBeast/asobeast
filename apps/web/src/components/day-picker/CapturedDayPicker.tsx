"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { addUtcDays } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  monthLabel,
  monthOf,
  monthWeeks,
  shiftMonth,
  type Month,
} from "./calendar-grid";
import { stepDate } from "./step-date";

const WEEKDAYS = [
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
  ["Sun", "Sunday"],
] as const;

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
          aria-label="Previous month"
          onClick={() => showMonth(shiftMonth(month, -1))}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <p className="text-body font-medium" aria-live="polite">
          {monthLabel(month)}
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next month"
          onClick={() => showMonth(shiftMonth(month, 1))}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
      <div
        ref={grid}
        role="grid"
        aria-label={monthLabel(month)}
        onKeyDown={onKeyDown}
        className="flex flex-col gap-1"
      >
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map(([short, full]) => (
            <span
              key={short}
              role="columnheader"
              aria-label={full}
              className="text-center text-caption text-muted-foreground"
            >
              {short}
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
                    aria-label={formatDate(date)}
                    aria-pressed={date === value}
                    disabled={!captured.has(date)}
                    tabIndex={date === focused ? 0 : -1}
                    onClick={() => onSelect(date)}
                    className={cn(
                      "numeric size-9 rounded-md font-mono text-sm text-muted-foreground disabled:cursor-not-allowed",
                      date === value
                        ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                        : "data-captured:bg-secondary data-captured:text-foreground data-captured:hover:bg-accent",
                      "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring",
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
  const anchor = value ?? dates[0] ?? null;
  const previous = value ? stepDate(dates, value, -1) : null;
  const next = value ? stepDate(dates, value, 1) : null;
  const pick = (date: string) => {
    setOpen(false);
    onSelect(date);
  };

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            aria-label={
              value ? `Captured day, ${formatDate(value)}` : "Captured day"
            }
            disabled={anchor === null}
            className="min-w-36 justify-start"
          >
            <CalendarDays aria-hidden />
            {value ? formatDate(value) : "No capture yet"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          aria-label="Choose captured day"
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
        aria-label="Previous captured day"
        disabled={previous === null}
        onClick={() => previous && onSelect(previous)}
      >
        <ChevronLeft aria-hidden />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next captured day"
        disabled={next === null}
        onClick={() => next && onSelect(next)}
      >
        <ChevronRight aria-hidden />
      </Button>
    </div>
  );
}
