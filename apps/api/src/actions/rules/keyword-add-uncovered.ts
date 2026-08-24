import {
  KeywordAddUncoveredEvidence,
  KEYWORD_FIELD_CHAR_LIMIT,
  KeywordCoverageRow,
  MetadataField,
  MetadataFieldAudit,
  ScoringConfidence,
  TrackedKeywordItem,
} from '@asobeast/shared';
import type { ActionContext, ActionContextApp } from '../action-context';
import type { ActionDetector, DetectedAction } from '../action-rule';

export const UNCOVERED_MIN_OPPORTUNITY = 60;
export const UNCOVERED_MIN_RELEVANCE = 60;
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

function qualifyingOpportunity(
  keyword: TrackedKeywordItem,
  homeCountry: string,
): number | null {
  if (!keyword.active || keyword.country !== homeCountry) return null;
  if (keyword.relevance === null || keyword.relevance < UNCOVERED_MIN_RELEVANCE)
    return null;
  if ((keyword.volume ?? 0) < UNCOVERED_MIN_VOLUME) return null;
  if (
    keyword.opportunity === null ||
    keyword.opportunity < UNCOVERED_MIN_OPPORTUNITY
  )
    return null;
  return keyword.opportunity;
}

function detectForApp(app: ActionContextApp): DetectedAction[] {
  const coverage = new Map<string, KeywordCoverageRow>(
    app.coverage.map((row) => [row.keywordId, row]),
  );
  const indexed = indexedFields(app.metadataFields);
  const charsFree = keywordFieldCharsFree(app.metadataFields);

  const detections: DetectedAction[] = [];
  for (const keyword of app.trackedKeywords) {
    const opportunity = qualifyingOpportunity(keyword, app.country);
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
      country: app.country,
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
    });
  }
  return detections;
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
