export interface Month {
  year: number;
  month: number;
}

export interface CalendarCell {
  date: string | null;
  weekday: number;
}

const CELLS = 42;
const WEEK = 7;

const monthLabelFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
  year: "numeric",
});

const pad = (value: number) => String(value).padStart(2, "0");

export function monthOf(date: string): Month {
  const [year, month] = date.split("-").map(Number);
  return { year, month };
}

export function shiftMonth({ year, month }: Month, delta: number): Month {
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1 };
}

export function monthLabel({ year, month }: Month): string {
  return monthLabelFormat.format(new Date(Date.UTC(year, month - 1, 1)));
}

export function monthGrid({ year, month }: Month): CalendarCell[] {
  const offset =
    (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % WEEK;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: CELLS }, (_, index) => {
    const day = index - offset + 1;
    return {
      date:
        day >= 1 && day <= days ? `${year}-${pad(month)}-${pad(day)}` : null,
      weekday: index % WEEK,
    };
  });
}

export function addUtcDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}
