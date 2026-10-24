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

const UTC_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z)?$/;

interface UtcValue {
  date: UtcDay;
  clock: string | null;
}

function utcValue(value: string): UtcValue | null {
  const match = UTC_PATTERN.exec(value);
  if (!match) return null;
  const parts = match.slice(1, 6).map((part) => Number(part ?? 0));
  const [year, month, day, hour, minute] = parts;
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const roundTrip = [
    instant.getUTCMonth() + 1,
    instant.getUTCDate(),
    instant.getUTCHours(),
    instant.getUTCMinutes(),
  ];
  if (roundTrip.some((part, index) => part !== parts[index + 1])) return null;
  return {
    date: { year, month, day },
    clock: match[4] === undefined ? null : `${match[4]}:${match[5]}`,
  };
}

const monthOf = (date: UtcDay): string => MONTHS[date.month - 1];

const dayMonth = (date: UtcDay): string => `${date.day} ${monthOf(date)}`;

const fullDate = (date: UtcDay): string => `${dayMonth(date)} ${date.year}`;

export function formatUtcDate(value: string): string {
  const parsed = utcValue(value);
  return parsed ? fullDate(parsed.date) : value;
}

export function formatUtcDateRange(from: string, to: string): string {
  const start = utcValue(from)?.date;
  const end = utcValue(to)?.date;
  if (!start || !end) return `${from} to ${to}`;
  if (start.year !== end.year) return `${fullDate(start)} to ${fullDate(end)}`;
  if (start.month !== end.month) {
    return `${dayMonth(start)} to ${fullDate(end)}`;
  }
  if (start.day === end.day) return fullDate(end);
  return `${start.day} to ${end.day} ${monthOf(end)} ${end.year}`;
}

export function formatUtcInstant(iso: string): string {
  const parsed = utcValue(iso);
  if (!parsed?.clock) return iso;
  return `${fullDate(parsed.date)}, ${parsed.clock} UTC`;
}
