import { z } from "zod";
import { isUtcCalendarDate, UTC_DATE_PATTERN } from "@asobeast/shared";

export { isUtcCalendarDate };

export const utcDate = z
  .string()
  .regex(UTC_DATE_PATTERN)
  .refine(isUtcCalendarDate, { error: "must be a date on the calendar" });
