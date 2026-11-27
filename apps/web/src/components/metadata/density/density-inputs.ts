import {
  type DefaultingListing,
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

export interface DensityApp extends DefaultingListing {
  name: string | null;
}

export function densityContext(
  audit: MetadataAuditResult,
  market: string,
  localization: string | undefined,
  app: DensityApp,
): DensityContext {
  return {
    store: audit.store,
    language: densityLanguage(audit.store, market, localization, app),
    appName: app.name,
    tracked: audit.coverage.map((row) => row.text),
    searched: descriptionSearch(audit),
  };
}
