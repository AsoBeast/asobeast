import {
  STORE_FIELD_LIMITS,
  type MetadataAuditResult,
  type Store,
} from "@asobeast/shared";
import { densityLanguage } from "./density-languages";

export interface DescriptionSearch {
  held: number;
  tracked: number;
}

export interface DensityContext {
  store: Store;
  language: string | null;
  appName: string | null;
  tracked: readonly string[];
  searched: DescriptionSearch | null;
}

const descriptionSearch = (
  audit: MetadataAuditResult,
): DescriptionSearch | null =>
  STORE_FIELD_LIMITS[audit.store].description?.indexed
    ? {
        held: audit.coverage.filter((row) =>
          row.fields.some(
            (field) => field.field === "description" && field.covered,
          ),
        ).length,
        tracked: audit.coverage.length,
      }
    : null;

export function densityContext(
  audit: MetadataAuditResult,
  market: string,
  localization: string | undefined,
  appName: string | null,
): DensityContext {
  return {
    store: audit.store,
    language: densityLanguage(audit.store, market, localization),
    appName,
    tracked: audit.coverage.map((row) => row.text),
    searched: descriptionSearch(audit),
  };
}
