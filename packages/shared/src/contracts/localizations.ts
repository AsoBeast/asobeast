import type { AppStoreLocalization } from '../storefronts/app-store-localizations';
import type { KeywordImportQuota } from './keywords';

export const APP_LOCALIZATION_ORIGINS = ['home', 'manual', 'detected'] as const;
export type AppLocalizationOrigin = (typeof APP_LOCALIZATION_ORIGINS)[number];

export const LOCALIZATION_READ_ROLES = ['default', 'additional'] as const;
export type LocalizationReadRole = (typeof LOCALIZATION_READ_ROLES)[number];

export interface LocalizationReader {
  country: string;
  role: LocalizationReadRole;
  home: boolean;
}

export interface AppLocalizationItem {
  localization: AppStoreLocalization;
  origin: AppLocalizationOrigin;
  phrases: string[];
  charactersUsed: number;
  charactersLimit: number;
  readBy: LocalizationReader[];
  updatedAt: string | null;
}

export interface AppLocalizationsResult {
  home: string;
  markets: string[];
  localizations: AppLocalizationItem[];
}

export interface AddAppLocalizationRequest {
  localization: AppStoreLocalization;
}

export interface LocalizedKeywordFieldRequest {
  text: string;
  trackIn: string[];
}

export interface LocalizedKeywordFieldResult {
  localization: AppLocalizationItem;
  duplicatesRemoved: number;
  trackedIn: string[];
}

export interface KeywordFieldPreviewRequest {
  text: string;
}

export interface KeywordFieldMarketPreview extends LocalizationReader {
  newPhrases: string[];
  keywordMarkets: number;
  dailyRequests: number;
}

export interface KeywordFieldSavePreview {
  localization: AppStoreLocalization;
  phrases: string[];
  added: string[];
  dropped: string[];
  duplicatesRemoved: number;
  charactersUsed: number;
  charactersLimit: number;
  markets: KeywordFieldMarketPreview[];
  quota: KeywordImportQuota | null;
}

export interface MarketLocalizationRead {
  localization: AppStoreLocalization;
  role: LocalizationReadRole;
  shipped: boolean;
  origin: AppLocalizationOrigin | null;
  phrases: string[];
  charactersUsed: number;
  charactersLimit: number;
}

export interface WastedWord {
  word: string;
  localizations: AppStoreLocalization[];
}

export interface SplitPhrasePart {
  word: string;
  localizations: AppStoreLocalization[];
}

export interface SplitPhrase {
  keywordId: string;
  phrase: string;
  parts: SplitPhrasePart[];
}

export interface MarketKeywordFields {
  country: string;
  home: boolean;
  localizations: MarketLocalizationRead[];
  wastedWords: WastedWord[];
  splitPhrases: SplitPhrase[];
}

export interface LocalizationDetectionResult {
  queued: number;
  candidates: AppStoreLocalization[];
}
