import {
  countChars,
  isAppStoreLocalization,
  keywordFieldLocalizations,
  STORE_FIELD_LIMITS,
  type AppStoreLocalization,
  type CoveragePreviewChange,
  type CoveragePreviewKeyword,
  type CoveragePreviewRequest,
  type CoveragePreviewResult,
  type DraftWastedWord,
  type ListingMarket,
  type MetadataAuditResult,
  type Store,
} from "@asobeast/shared";
import { formatCountry, formatList } from "./format";
import { METADATA_FIELD_LABELS } from "./metadata-display";
import {
  readStoredPreference,
  writeStoredPreference,
} from "./use-stored-preference";

export const LISTING_DRAFT_FIELDS = [
  "title",
  "subtitle",
  "promotionalText",
  "shortDescription",
  "keywordField",
  "description",
] as const;

export type ListingDraftField = (typeof LISTING_DRAFT_FIELDS)[number];

export const isListingDraftField = (
  field: string,
): field is ListingDraftField =>
  LISTING_DRAFT_FIELDS.some((candidate) => candidate === field);

export type ListingDraftValues = Partial<Record<ListingDraftField, string>>;

export type DraftScope =
  | { store: "APP_STORE"; localization: AppStoreLocalization }
  | { store: "GOOGLE_PLAY"; country: string };

const DRAFT_VERSION = 1;

export const scopeKey = (scope: DraftScope): string =>
  scope.store === "APP_STORE" ? scope.localization : scope.country;

export function draftScopeOf(
  store: Store,
  market: string,
  localization: string | undefined,
): DraftScope {
  if (store === "GOOGLE_PLAY") return { store, country: market };
  if (localization !== undefined && isAppStoreLocalization(localization)) {
    return { store, localization };
  }
  return { store, localization: keywordFieldLocalizations(market)[0] };
}

export interface DraftView {
  market: string;
  localization: AppStoreLocalization | null;
}

export function draftView(
  home: string,
  drafted: AppStoreLocalization | null,
  markets: readonly Pick<ListingMarket, "country" | "localizations">[],
): DraftView | null {
  if (drafted === null || drafted === keywordFieldLocalizations(home)[0]) {
    return { market: home, localization: null };
  }
  const reader = markets.find((entry) =>
    entry.localizations?.includes(drafted),
  );
  return reader ? { market: reader.country, localization: drafted } : null;
}

export const listingDraftKey = (appId: string, scope: string): string =>
  `asobeast.listingDraft.${appId}.${scope}`;

export const draftFieldsOf = (store: Store): ListingDraftField[] =>
  LISTING_DRAFT_FIELDS.filter(
    (field) => STORE_FIELD_LIMITS[store][field] !== undefined,
  );

const coverageFieldsOf = (store: Store): ListingDraftField[] =>
  draftFieldsOf(store).filter((field) => field !== "promotionalText");

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

export function writeListingDraftField(
  appId: string,
  scope: string,
  field: ListingDraftField,
  value: string,
): void {
  const key = listingDraftKey(appId, scope);
  const stored = parseListingDraft(readStoredPreference(key));
  writeStoredPreference(
    key,
    serializeListingDraft({ ...stored, [field]: value }),
  );
}

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
  const fields = coverageFieldsOf(scope.store);
  const changed = changedFields(values, live);
  if (!fields.some((field) => changed.includes(field))) return null;
  return {
    ...(scope.store === "APP_STORE"
      ? { localization: scope.localization }
      : { country: scope.country }),
    ...Object.fromEntries(fields.map((field) => [field, values[field] ?? ""])),
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

export interface PreviewGroups {
  groups: Record<CoveragePreviewChange, CoveragePreviewKeyword[]>;
  showCountry: boolean;
}

export function previewGroups(
  result: Pick<CoveragePreviewResult, "keywords" | "markets">,
): PreviewGroups {
  const of = (change: CoveragePreviewChange) =>
    result.keywords.filter((keyword) => keyword.change === change);
  return {
    groups: {
      lost: of("lost"),
      gained: of("gained"),
      missing: of("missing"),
      kept: of("kept"),
    },
    showCountry: result.markets.length > 1,
  };
}

export const wasteReason = (wasted: DraftWastedWord): string =>
  wasted.reason === "unused"
    ? "No tracked keyword uses it"
    : `Repeated in ${formatList(
        wasted.fields.map((field) =>
          METADATA_FIELD_LABELS[field].toLowerCase(),
        ),
      )}`;

export function marketNote({
  markets,
  waitingMarkets,
}: Pick<CoveragePreviewResult, "markets" | "waitingMarkets">): string | null {
  if (waitingMarkets.length === 0) {
    return markets.length === 0
      ? "No market you track reads this localization yet."
      : null;
  }
  const names = formatList(waitingMarkets.map(formatCountry));
  const waiting =
    waitingMarkets.length === 1
      ? `${names} is judged on your home listing until its own listing is captured`
      : `${names} are judged on your home listing until their own listings are captured`;
  return markets.length === 0
    ? `${waiting}, so no keyword is judged here yet.`
    : `${waiting}.`;
}

export const CONSOLE_NAMES: Record<Store, string> = {
  APP_STORE: "App Store Connect",
  GOOGLE_PLAY: "Play Console",
};

const CONSOLE_LABELS: Record<
  Store,
  Partial<Record<ListingDraftField, string>>
> = {
  APP_STORE: {
    title: "Name",
    subtitle: "Subtitle",
    promotionalText: "Promotional Text",
    keywordField: "Keywords",
    description: "Description",
  },
  GOOGLE_PLAY: {
    title: "App name",
    shortDescription: "Short description",
    description: "Full description",
  },
};

export function consoleCopy(store: Store, values: ListingDraftValues): string {
  return draftFieldsOf(store)
    .flatMap((field) => {
      const value = values[field] ?? "";
      return value === "" ? [] : [`${CONSOLE_LABELS[store][field]}\n${value}`];
    })
    .join("\n\n");
}
