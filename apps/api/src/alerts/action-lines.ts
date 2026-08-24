import { ActionEvidence, ActionOpenedPayload } from '@asobeast/shared';

const RULE_SUMMARY = (evidence: ActionEvidence): string => {
  switch (evidence.rule) {
    case 'keyword.add_uncovered':
      return `opportunity ${evidence.opportunity}, volume ${evidence.volume ?? '—'}, uncovered in ${evidence.uncoveredFields.join(', ')}`;
    case 'keyword.defend':
      return `${evidence.entrants.length} new entrants, ${evidence.entrantsAtOrAbove} at or above you over ${evidence.observedDays}/${evidence.windowDays} days`;
    case 'keyword.prune':
      return `ranked ${evidence.rankedDays}/${evidence.checkedDays} checks, saves ${evidence.dailyRequestsSaved} request/day`;
    case 'rank.investigate_drop':
      return `changed ${evidence.fields.join(', ')} on ${evidence.changedAt}, visibility ${evidence.visibilityBefore ?? '—'} → ${evidence.visibilityAfter ?? '—'}, ${evidence.droppedKeywords.length} keywords fell`;
    case 'serp.hold_volatile':
      return `volatility ${evidence.volatility} over ${evidence.observedDays}/${evidence.windowDays} days, damped ${evidence.dampenedRules.join(', ')}`;
    case 'audit.fix_factor':
      return `${evidence.factorLabel} scored ${evidence.score}/10 at weight ${evidence.weight} on ${evidence.auditDate}`;
    case 'reviews.investigate_theme':
      return `"${evidence.theme}" in ${evidence.mentions} of ${evidence.negativeReviews} negative reviews for ${evidence.version ?? 'the latest version'} (was ${evidence.previousMentions})`;
    case 'market.improve_country':
      return `visibility ${evidence.marketVisibility} against ${evidence.homeVisibility} at home, a ${evidence.gap} point gap`;
    default: {
      const never: never = evidence;
      return never;
    }
  }
};

export function summarizeActionEvidence(evidence: ActionEvidence): string {
  return RULE_SUMMARY(evidence);
}

export function actionScopeLine(payload: ActionOpenedPayload): string {
  const store =
    payload.app.store === 'GOOGLE_PLAY' ? 'Google Play' : 'App Store';
  return `${payload.app.country.toUpperCase()} · ${store} · ${summarizeActionEvidence(payload.evidence)}`;
}
