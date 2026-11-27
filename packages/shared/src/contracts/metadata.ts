import type { AiStatus } from './ai';
import type { KeywordClass } from './keywords';
import type { TargetSlotRole } from './listing-targets';
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
  wordsSplit?: boolean;
  screenshotText?: ScreenshotTextCoverage | null;
  country?: string;
  listingCountry?: string;
}

export interface KeywordFieldSuggestion {
  value: string;
  charactersUsed: number;
  charactersLimit: number;
  addedTerms: string[];
  localization?: AppStoreLocalization;
}

export interface MetadataAuditResult {
  appId: string;
  store: Store;
  fields: MetadataFieldAudit[];
  coverage: KeywordCoverageRow[];
  keywordFieldSuggestion: KeywordFieldSuggestion | null;
  screenshotText?: ScreenshotTextState | null;
  country?: string;
  localization?: string;
}

export interface CoveragePreviewRequest {
  localization?: AppStoreLocalization;
  country?: string;
  title?: string;
  subtitle?: string;
  shortDescription?: string;
  keywordField?: string;
  description?: string;
}

export const COVERAGE_PREVIEW_CHANGES = [
  'lost',
  'gained',
  'missing',
  'kept',
] as const;
export type CoveragePreviewChange = (typeof COVERAGE_PREVIEW_CHANGES)[number];

export const isCoveragePreviewChange = (
  value: unknown,
): value is CoveragePreviewChange =>
  typeof value === 'string' &&
  COVERAGE_PREVIEW_CHANGES.some((change) => change === value);

export interface CoverageVerdict {
  fields: CoverageFieldStatus[];
  covered: boolean;
  wordsSplit: boolean;
}

export interface CoveragePreviewKeyword {
  keywordId: string;
  text: string;
  country: string;
  bucket: KeywordBucket | null;
  keywordClass?: KeywordClass;
  live: CoverageVerdict;
  draft: CoverageVerdict;
  change: CoveragePreviewChange;
}

export interface CoveragePreviewTarget {
  position: number;
  role: TargetSlotRole;
  text: string;
  live: CoverageVerdict;
  draft: CoverageVerdict;
}

export const DRAFT_WASTE_REASONS = ['repeated', 'unused'] as const;
export type DraftWasteReason = (typeof DRAFT_WASTE_REASONS)[number];

export interface DraftWastedWord {
  word: string;
  reason: DraftWasteReason;
  fields: MetadataField[];
}

export interface CoveragePreviewResult {
  appId: string;
  store: Store;
  localization?: AppStoreLocalization;
  country?: string;
  markets: string[];
  waitingMarkets: string[];
  fields: MetadataFieldAudit[];
  keywords: CoveragePreviewKeyword[];
  wastedWords: DraftWastedWord[];
  counts: Record<CoveragePreviewChange, number>;
  targets?: CoveragePreviewTarget[];
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

export type MetadataAssistantStatus = AiStatus;

export interface MetadataAssistantRequest {
  fields?: MetadataField[];
  instructions?: string;
  localization?: AppStoreLocalization;
}
