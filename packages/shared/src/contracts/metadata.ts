import { KeywordBucket, Store } from '../index';
import { LintIssue } from '../aso/lint';
import { MetadataField } from '../aso/limits';
import { AppStoreLocalization } from '../storefronts/app-store-localizations';
import type {
  ScreenshotTextCoverage,
  ScreenshotTextState,
} from './screenshots';

export interface MetadataFieldAudit {
  field: MetadataField;
  value: string | null;
  chars: number;
  limit: number;
  indexed: boolean;
  issues: LintIssue[];
}

export interface CoverageFieldStatus {
  field: MetadataField;
  covered: boolean;
  localization?: string;
}

export interface KeywordCoverageRow {
  keywordId: string;
  text: string;
  bucket: KeywordBucket | null;
  fields: CoverageFieldStatus[];
  uncovered: boolean;
  screenshotText?: ScreenshotTextCoverage | null;
  country?: string;
  listingCountry?: string;
}

export interface KeywordFieldSuggestion {
  value: string;
  charactersUsed: number;
  charactersLimit: number;
  addedTerms: string[];
}

export interface MetadataAuditResult {
  appId: string;
  store: Store;
  fields: MetadataFieldAudit[];
  coverage: KeywordCoverageRow[];
  keywordFieldSuggestion: KeywordFieldSuggestion | null;
  screenshotText?: ScreenshotTextState | null;
  country?: string;
}

export interface MetadataDraft {
  field: MetadataField;
  value: string;
  chars: number;
  limit: number;
  issues: LintIssue[];
  rationale: string;
}

export interface MetadataAssistantResult {
  model: string;
  drafts: MetadataDraft[];
  localization?: AppStoreLocalization | null;
}

export interface MetadataAssistantStatus {
  configured: boolean;
  model: string | null;
}

export interface MetadataAssistantRequest {
  fields?: MetadataField[];
  instructions?: string;
  localization?: AppStoreLocalization;
}
