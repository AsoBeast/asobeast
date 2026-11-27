import {
  KeywordAddUncoveredEvidence,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordCoverageRow,
  MetadataField,
  MetadataFieldAudit,
  ScoringConfidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import {
  OPPORTUNITY_HIGH,
  OPPORTUNITY_MIN_RELEVANCE,
} from '../../scoring/opportunity';
import { fitsOwnListing } from '../../keywords/keyword-class';
import type { ActionContext, ActionContextApp } from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';
import { ActionMarketMetadata, appListings } from '../action-market-metadata';

export const UNCOVERED_MIN_RELEVANCE = OPPORTUNITY_MIN_RELEVANCE;
export const UNCOVERED_MIN_VOLUME = 20;

export const UNCOVERED_PROVENANCE_CONFIDENCE: Record<
  ScoringConfidence,
  number
> = {
  HIGH: 1,
  MEDIUM: 0.6,
  LOW: 0.3,
};

export const UNCOVERED_UNSCORED_CONFIDENCE = 0.3;

function indexedFields(fields: MetadataFieldAudit[]): MetadataField[] {
  return fields.filter((field) => field.indexed).map((field) => field.field);
}

function keywordFieldCharsFree(fields: MetadataFieldAudit[]): number | null {
  const declared = fields.find((field) => field.field === 'keywordField');
  if (declared) {
    return Math.max(0, declared.limit - declared.chars);
  }
  return fields.some((field) => field.field === 'subtitle')
    ? KEYWORD_FIELD_CHAR_LIMIT
    : null;
}

function qualifyingOpportunity(keyword: TrackedKeywordItem): number | null {
  if (keyword.relevance === null || keyword.relevance < UNCOVERED_MIN_RELEVANCE)
    return null;
  if ((keyword.volume ?? 0) < UNCOVERED_MIN_VOLUME) return null;
  if (keyword.opportunity === null || keyword.opportunity < OPPORTUNITY_HIGH)
    return null;
  return keyword.opportunity;
}

function detectInMarket(
  app: ActionContextApp,
  market: ActionMarketMetadata,
): DetectedAction[] {
  const coverage = new Map<string, KeywordCoverageRow>(
    market.coverage.map((row) => [row.keywordId, row]),
  );
  const indexed = indexedFields(market.fields);
  const charsFree = keywordFieldCharsFree(market.fields);

  const detections: DetectedAction[] = [];
  for (const keyword of app.trackedKeywords) {
    if (!keyword.active || keyword.country !== market.country) continue;
    if (!fitsOwnListing(keyword.keywordClass)) continue;
    const withheld = keyword.scoreOutdated === true;
    const opportunity = withheld
      ? (keyword.opportunity ?? 0)
      : qualifyingOpportunity(keyword);
    if (opportunity === null) continue;
    const row = coverage.get(keyword.keywordId);
    if (!row || !row.uncovered) continue;

    const evidence: KeywordAddUncoveredEvidence = {
      rule: 'keyword.add_uncovered',
      opportunity,
      traffic: keyword.traffic,
      difficulty: keyword.difficulty,
      volume: keyword.volume,
      relevance: keyword.relevance,
      latestPosition: keyword.latestPosition,
      latestDepth: keyword.latestDepth,
      indexedFields: indexed,
      uncoveredFields: row.fields
        .filter((field) => !field.covered)
        .map((field) => field.field),
      keywordFieldCharsFree: charsFree,
      scoreProvenance: keyword.scoreProvenance,
    };

    detections.push({
      rule: 'keyword.add_uncovered',
      appId: app.id,
      store: app.store,
      country: market.country,
      keywordId: keyword.keywordId,
      discriminator: null,
      terms: {
        reach: (keyword.volume ?? 0) / 100,
        severity: opportunity / 100,
        confidence: keyword.scoreProvenance
          ? UNCOVERED_PROVENANCE_CONFIDENCE[keyword.scoreProvenance.confidence]
          : UNCOVERED_UNSCORED_CONFIDENCE,
      },
      evidence,
      ...(withheld ? { withheld: true as const } : {}),
    });
  }
  return detections;
}

function detectForApp(app: ActionContextApp): DetectedAction[] {
  return appListings(app).flatMap((market) => detectInMarket(app, market));
}

export function detectKeywordAddUncovered(
  context: ActionContext,
): DetectedAction[] {
  return context.apps.flatMap(detectForApp);
}

export const keywordAddUncoveredDetector: ActionDetector = {
  rule: 'keyword.add_uncovered',
  detect: (context) => detectKeywordAddUncovered(context),
};
