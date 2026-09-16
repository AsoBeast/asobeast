import { UTC_DATE_PATTERN } from "@asobeast/shared";

export function isUtcCalendarDate(value: string): boolean {
  if (!UTC_DATE_PATTERN.test(value)) return false;
  const instant = Date.parse(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(instant) && new Date(instant).toISOString().startsWith(value)
  );
}
