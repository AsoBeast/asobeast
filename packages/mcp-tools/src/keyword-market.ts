import { z } from "zod";
import { COUNTRY_PATTERN } from "@asobeast/shared";

export const keywordMarket = z
  .string()
  .regex(COUNTRY_PATTERN)
  .optional()
  .describe(
    "Two-letter storefront code. Counts only the keywords tracked in that market; omitted means every market the app tracks.",
  );
