import {
  countChars,
  isAppStoreLocalization,
  keywordFieldLocalizations,
  STORE_FIELD_LIMITS,
  type AppStoreLocalization,
  type CoveragePreviewRequest,
  type MetadataAuditResult,
  type Store,
} from "@asobeast/shared";

export const LISTING_DRAFT_FIELDS = [
  "title",
  "subtitle",
  "shortDescription",
  "keywordField",
  "description",
] as const;

export type ListingDraftField = (typeof LISTING_DRAFT_FIELDS)[number];

export type ListingDraftValues = Partial<Record<ListingDraftField, string>>;

export type DraftScope =
  | { store: "APP_STORE"; localization: AppStoreLocalization }
  | { store: "GOOGLE_PLAY"; country: string };

const DRAFT_VERSION = 1;

export const scopeKey = (scope: DraftScope): string =>
  scope.store === "APP_STORE" ? scope.localization : scope.country;

export const draftScopeOf = (
  store: Store,
  market: string,
  localization: string | undefined,
): DraftScope =>
  store === "GOOGLE_PLAY"
    ? { store, country: market }
    : {
        store,
        localization:
          localization !== undefined && isAppStoreLocalization(localization)
            ? localization
            : keywordFieldLocalizations(market)[0],
      };

export const listingDraftKey = (appId: string, scope: string): string =>
  `asobeast.listingDraft.${appId}.${scope}`;

export const draftFieldsOf = (store: Store): ListingDraftField[] =>
  LISTING_DRAFT_FIELDS.filter(
    (field) =>
      field === "description" || STORE_FIELD_LIMITS[store][field]?.indexed,
  );

export const liveDraftValues = (
  audit: Pick<MetadataAuditResult, "store" | "fields">,
): ListingDraftValues =>
  Object.fromEntries(
    draftFieldsOf(audit.store).map((field) => [
      field,
      audit.fields.find((entry) => entry.field === field)?.value ?? "",
    ]),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function parsed(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseListingDraft(
  raw: string | null,
): ListingDraftValues | null {
  if (!raw) return null;
  const value = parsed(raw);
  if (!isRecord(value) || value.v !== DRAFT_VERSION) return null;
  const draft: ListingDraftValues = {};
  for (const field of LISTING_DRAFT_FIELDS) {
    const text = value[field];
    if (typeof text === "string") draft[field] = text;
  }
  return draft;
}

export const serializeListingDraft = (values: ListingDraftValues): string =>
  Object.keys(values).length === 0
    ? ""
    : JSON.stringify({ v: DRAFT_VERSION, ...values });

export const draftValues = (
  stored: ListingDraftValues | null,
  live: ListingDraftValues,
): ListingDraftValues => ({ ...live, ...stored });

export const changedFields = (
  values: ListingDraftValues,
  live: ListingDraftValues,
): ListingDraftField[] =>
  LISTING_DRAFT_FIELDS.filter(
    (field) =>
      values[field] !== undefined && values[field] !== (live[field] ?? ""),
  );

export function draftRequest(
  scope: DraftScope,
  values: ListingDraftValues,
  live: ListingDraftValues,
): CoveragePreviewRequest | null {
  const changed = changedFields(values, live);
  if (changed.length === 0) return null;
  return {
    ...(scope.store === "APP_STORE"
      ? { localization: scope.localization }
      : { country: scope.country }),
    ...Object.fromEntries(changed.map((field) => [field, values[field]])),
  };
}

export interface FieldCount {
  used: number;
  limit: number;
  over: number;
  text: string;
}

export function fieldCount(
  store: Store,
  field: ListingDraftField,
  value: string,
): FieldCount {
  const limit = STORE_FIELD_LIMITS[store][field]?.limit ?? 0;
  const used = countChars(value);
  const over = Math.max(0, used - limit);
  return {
    used,
    limit,
    over,
    text: `${used}/${limit}${over > 0 ? ` · ${over} over` : ""}`,
  };
}
