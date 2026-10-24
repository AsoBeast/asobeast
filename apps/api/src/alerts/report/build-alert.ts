import { formatUtcInstant } from '@asobeast/shared';
import type {
  AlertReport,
  ReportApp,
  ReportIdentity,
  ReportLink,
  ReportTone,
} from './report';
import { factsOf } from './report-facts';
import { reportLinks, type ReportLinks } from './report-links';
import { appName, sentenceOf, type GranularPayload } from './report-sentences';

type AppPayload = Extract<GranularPayload, { app: unknown }>;

function roleOf(payload: AppPayload): ReportIdentity['role'] {
  return payload.event === 'metadata.changed' && payload.app.isCompetitor
    ? 'competitor'
    : 'primary';
}

function alertApp(payload: AppPayload, links: ReportLinks): ReportApp {
  const { app } = payload;
  return {
    id: app.id,
    identity: {
      name: appName(app.name),
      iconUrl: app.iconUrl ?? null,
      store: app.store ?? null,
      country: app.country ?? null,
      role: roleOf(payload),
    },
    link: links.app(app.id),
    groups: [],
    competitors: [],
    omittedCompetitors: 0,
    competitorsLink: null,
  };
}

function linkOf(
  payload: GranularPayload,
  links: ReportLinks,
): ReportLink | null {
  if (payload.event === 'action.opened') return links.action(payload.link);
  if ('app' in payload) return links.app(payload.app.id);
  return links.home;
}

function toneOf(payload: GranularPayload): ReportTone {
  switch (payload.event) {
    case 'rank.dropped':
    case 'rank.overtaken':
    case 'review.negative':
      return 'down';
    case 'rank.improved':
    case 'rank.first':
      return 'up';
    case 'rank.milestone':
      return payload.direction === 'entered' ? 'up' : 'down';
    default:
      return 'neutral';
  }
}

export function buildAlert(
  payload: GranularPayload,
  origin: string | null,
  withFlag = true,
): AlertReport {
  const links = reportLinks(origin);
  const sentence = sentenceOf(payload, withFlag);
  return {
    kind: 'single',
    event: payload.event,
    headline: sentence.text,
    emoji: sentence.emoji,
    tone: toneOf(payload),
    occurredAt: payload.occurredAt,
    window: payload.event === 'digest.weekly' ? payload.window : null,
    dateLabel: formatUtcInstant(payload.occurredAt),
    link: linkOf(payload, links),
    apps: 'app' in payload ? [alertApp(payload, links)] : [],
    omittedApps: 0,
    facts: factsOf(payload),
  };
}
