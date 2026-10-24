const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

interface UtcDay {
  year: number;
  month: number;
  day: number;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const CLOCK_PATTERN = /^\d{4}-\d{2}-\d{2}T(\d{2}):(\d{2})/;

function utcDay(value: string): UtcDay | null {
  const match = DAY_PATTERN.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

const monthOf = (date: UtcDay): string => MONTHS[date.month - 1];

const dayMonth = (date: UtcDay): string => `${date.day} ${monthOf(date)}`;

const fullDate = (date: UtcDay): string => `${dayMonth(date)} ${date.year}`;

export function formatUtcDate(value: string): string {
  const date = utcDay(value);
  return date ? fullDate(date) : value;
}

export function formatUtcDateRange(from: string, to: string): string {
  const start = utcDay(from);
  const end = utcDay(to);
  if (!start || !end) return `${from} to ${to}`;
  if (start.year !== end.year) return `${fullDate(start)} to ${fullDate(end)}`;
  if (start.month !== end.month) {
    return `${dayMonth(start)} to ${fullDate(end)}`;
  }
  if (start.day === end.day) return fullDate(end);
  return `${start.day} to ${end.day} ${monthOf(end)} ${end.year}`;
}

export function formatUtcInstant(iso: string): string {
  const date = utcDay(iso);
  const clock = CLOCK_PATTERN.exec(iso);
  if (!date || !clock) return iso;
  return `${fullDate(date)}, ${clock[1]}:${clock[2]} UTC`;
}
