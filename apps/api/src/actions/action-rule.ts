import { ActionEvidence, ActionRule, Store } from '@asobeast/shared';
import type { ActionContext } from './action-context';
import type { ImpactTerms } from './action-impact';
import { auditFixFactorDetector } from './rules/audit-fix-factor';
import { keywordAddUncoveredDetector } from './rules/keyword-add-uncovered';
import { keywordDefendDetector } from './rules/keyword-defend';
import { keywordPushToTop10Detector } from './rules/keyword-push-to-top10';
import { metadataFixLintDetector } from './rules/metadata-fix-lint';
import { rankInvestigateUnexplainedDropDetector } from './rules/rank-investigate-unexplained-drop';
import { competitorInvestigateOvertakeDetector } from './rules/competitor-investigate-overtake';
import { reviewsInvestigateRatingDeclineDetector } from './rules/reviews-investigate-rating-decline';
import { keywordPruneDetector } from './rules/keyword-prune';
import { marketImproveCountryDetector } from './rules/market-improve-country';
import { rankInvestigateDropDetector } from './rules/rank-investigate-drop';
import { reviewsInvestigateThemeDetector } from './rules/reviews-investigate-theme';
import { serpHoldVolatileDetector } from './rules/serp-hold-volatile';

export interface DetectedAction {
  rule: ActionRule;
  appId: string;
  store: Store;
  country: string;
  keywordId: string | null;
  discriminator: string | null;
  terms: ImpactTerms;
  evidence: ActionEvidence;
  dampenedBy?: ActionRule;
  withheld?: true;
}

export interface ActionDetector {
  rule: ActionRule;
  detect(context: ActionContext, now: Date): DetectedAction[];
}

export const ACTION_DETECTORS: readonly ActionDetector[] = Object.freeze([
  keywordAddUncoveredDetector,
  keywordPruneDetector,
  keywordDefendDetector,
  rankInvestigateDropDetector,
  serpHoldVolatileDetector,
  auditFixFactorDetector,
  reviewsInvestigateThemeDetector,
  marketImproveCountryDetector,
  keywordPushToTop10Detector,
  metadataFixLintDetector,
  rankInvestigateUnexplainedDropDetector,
  competitorInvestigateOvertakeDetector,
  reviewsInvestigateRatingDeclineDetector,
]);
