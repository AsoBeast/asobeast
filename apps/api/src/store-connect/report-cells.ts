const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_FIRST_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function dateOf(raw: string): string | null {
  const value = raw.trim();
  if (ISO_DATE.test(value)) return value;
  const monthFirst = MONTH_FIRST_DATE.exec(value);
  if (!monthFirst) return null;
  const [, month, day, year] = monthFirst;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

const MAX_COUNT = 2_147_483_647;

export function countOf(raw: string): number | null {
  const value = raw.trim().replace(/,/g, '');
  if (value.length === 0) return 0;
  const count = Number(value);
  return Number.isInteger(count) && count >= 0 && count <= MAX_COUNT
    ? count
    : null;
}
