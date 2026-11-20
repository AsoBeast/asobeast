const FALLBACK_LANGUAGE = 'en';
const DAY_MS = 86_400_000;
const CALENDAR_PROBE = Date.UTC(2000, 6, 1);
const FIRST_PLAY_YEAR = 2008;
const YEAR_DIGITS = /(?<!\d)\d{4}(?!\d)/g;

interface StoreDateFormat {
  format: Intl.DateTimeFormat;
  yearOffset: number;
}

const formats = new Map<string, StoreDateFormat>();

const comparable = (text: string): string =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

function storeDateFormat(language: string): StoreDateFormat {
  const known = formats.get(language);
  if (known) {
    return known;
  }
  const format = new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeZone: 'UTC',
  });
  const calendarYear = format
    .formatToParts(CALENDAR_PROBE)
    .find((part) => part.type === 'year')?.value;
  const created = {
    format,
    yearOffset:
      Number(calendarYear) - new Date(CALENDAR_PROBE).getUTCFullYear(),
  };
  formats.set(language, created);
  return created;
}

function dayIn(
  target: string,
  calendarYear: number,
  language: string,
): Date | undefined {
  const { format, yearOffset } = storeDateFormat(language);
  const year = calendarYear - yearOffset;
  if (Number.isNaN(year) || year < FIRST_PLAY_YEAR) {
    return undefined;
  }
  const end = Date.UTC(year + 1, 0, 1);
  for (let time = Date.UTC(year, 0, 1); time < end; time += DAY_MS) {
    if (comparable(format.format(time)) === target) {
      return new Date(time);
    }
  }
  return undefined;
}

export function playReleaseDate(
  value: string | undefined,
  language: string,
): Date | undefined {
  const target = comparable(value ?? '');
  const years = target.match(YEAR_DIGITS) ?? [];
  if (years.length !== 1) {
    return undefined;
  }
  const year = Number(years[0]);
  for (const candidate of new Set([language, FALLBACK_LANGUAGE])) {
    const day = dayIn(target, year, candidate);
    if (day) {
      return day;
    }
  }
  return undefined;
}
