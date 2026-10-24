import {
  formatUtcDateRange,
  type AlertBatchAppSection,
  type AlertBatchPayload,
} from '@asobeast/shared';
import {
  REPORT_GROUP_KINDS,
  type AlertReport,
  type GroupTone,
  type ReportApp,
  type ReportGroup,
  type ReportGroupKind,
  type ReportIdentity,
  type ReportRow,
  type ReportTone,
} from './report';
import { reportLinks, type ReportLinks } from './report-links';
import {
  actionRow,
  changeRows,
  entrantRows,
  firstRankingRow,
  milestoneRow,
  overtakeRow,
  rankRow,
  reviewRow,
} from './report-rows';
import { appName, plural } from './report-sentences';

export interface ReportCaps {
  apps: number;
  competitors: number;
  rows: number;
}

export const DEFAULT_CAPS: ReportCaps = { apps: 10, competitors: 10, rows: 20 };

type Section = AlertBatchAppSection;
type CompetitorSection = Section['competitors'][number];

interface GroupSource {
  title: string;
  tone: (section: Section) => GroupTone;
  rows: (section: Section, country: string) => ReportRow[];
}

const always = (tone: GroupTone) => (): GroupTone => tone;

const GROUP_SOURCES: Record<ReportGroupKind, GroupSource> = {
  rankDrops: {
    title: 'Rank drops',
    tone: always('down'),
    rows: (section, country) =>
      section.rankDrops.map((alert) => rankRow(alert, country)),
  },
  rankImprovements: {
    title: 'Rank improvements',
    tone: always('up'),
    rows: (section, country) =>
      section.rankImprovements.map((alert) => rankRow(alert, country)),
  },
  milestones: {
    title: 'Milestones',
    tone: (section) =>
      (section.rankMilestones ?? []).every(
        (alert) => alert.direction === 'entered',
      )
        ? 'up'
        : 'down',
    rows: (section, country) =>
      (section.rankMilestones ?? []).map((alert) =>
        milestoneRow(alert, country),
      ),
  },
  firstRankings: {
    title: 'First rankings',
    tone: always('up'),
    rows: (section, country) =>
      (section.firstRankings ?? []).map((alert) =>
        firstRankingRow(alert, country),
      ),
  },
  overtakes: {
    title: 'Overtaken by competitors',
    tone: always('down'),
    rows: (section, country) =>
      (section.overtakes ?? []).map((alert) => overtakeRow(alert, country)),
  },
  serpEntrants: {
    title: 'New in the top 10',
    tone: always('neutral'),
    rows: (section, country) =>
      section.serpEntrants.flatMap((alert) => entrantRows(alert, country)),
  },
  changes: {
    title: 'Listing changes',
    tone: always('neutral'),
    rows: (section) => section.changes.flatMap(changeRows),
  },
  negativeReviews: {
    title: 'Negative reviews',
    tone: always('down'),
    rows: (section) => section.negativeReviews.map(reviewRow),
  },
  actions: {
    title: 'New actions',
    tone: always('neutral'),
    rows: (section) => section.actions.map(actionRow),
  },
};

interface Build {
  links: ReportLinks;
  caps: ReportCaps;
}

function capped(
  kind: ReportGroupKind,
  title: string,
  tone: GroupTone,
  rows: ReportRow[],
  link: ReportGroup['link'],
  caps: ReportCaps,
): ReportGroup {
  return {
    kind,
    title,
    tone,
    rows: rows.slice(0, caps.rows),
    total: rows.length,
    link,
  };
}

function ownedGroups(section: Section, build: Build): ReportGroup[] {
  const scores = section.negativeReviews.map((alert) => alert.review.score);
  return REPORT_GROUP_KINDS.flatMap((kind) => {
    const source = GROUP_SOURCES[kind];
    const rows = source.rows(section, section.app.country);
    if (rows.length === 0) return [];
    const link = build.links.group(section.app.id, kind, rows.length, scores);
    return [
      capped(kind, source.title, source.tone(section), rows, link, build.caps),
    ];
  });
}

function identityOf(
  app: Section['app'],
  role: ReportIdentity['role'],
): ReportIdentity {
  return {
    name: appName(app.name),
    iconUrl: app.iconUrl ?? null,
    store: app.store,
    country: app.country,
    role,
  };
}

function shell(
  app: Section['app'],
  role: ReportIdentity['role'],
  build: Build,
): ReportApp {
  return {
    id: app.id,
    identity: identityOf(app, role),
    link: build.links.app(app.id),
    groups: [],
    competitors: [],
    omittedCompetitors: 0,
    competitorsLink: null,
  };
}

function competitorApp(
  competitor: CompetitorSection,
  primaryId: string,
  build: Build,
): ReportApp {
  const rows = competitor.changes.flatMap(changeRows);
  const changes = capped(
    'changes',
    GROUP_SOURCES.changes.title,
    'neutral',
    rows,
    build.links.group(primaryId, 'changes', rows.length),
    build.caps,
  );
  return {
    ...shell(competitor.app, 'competitor', build),
    groups: rows.length > 0 ? [changes] : [],
  };
}

function withCompetitors(
  app: ReportApp,
  section: Section,
  build: Build,
): ReportApp {
  const shown = section.competitors.slice(0, build.caps.competitors);
  const omitted = section.competitors.length - shown.length;
  return {
    ...app,
    competitors: shown.map((competitor) =>
      competitorApp(competitor, section.app.id, build),
    ),
    omittedCompetitors: omitted,
    competitorsLink:
      omitted > 0
        ? build.links.competitors(section.app.id, section.competitors.length)
        : null,
  };
}

function reportApp(
  section: Section,
  scope: AlertBatchPayload['scope'] | undefined,
  build: Build,
): ReportApp {
  const app = shell(section.app, 'primary', build);
  const owned =
    scope === 'competitors'
      ? app
      : { ...app, groups: ownedGroups(section, build) };
  return scope === 'owned_apps'
    ? owned
    : withCompetitors(owned, section, build);
}

function headlineOf(payload: AlertBatchPayload): {
  emoji: string;
  headline: string;
} {
  const changes = plural(payload.totals.events, 'change');
  if (payload.scope === 'competitors') {
    return {
      emoji: '🔭',
      headline: `Competitor watch: ${changes} across ${plural(payload.totals.apps, 'competitor')}`,
    };
  }
  const label =
    payload.scope === 'owned_apps' ? 'Daily app update' : 'Daily update';
  return {
    emoji: '📊',
    headline: `${label}: ${changes} across ${plural(payload.totals.apps, 'app')}`,
  };
}

function groupTones(app: ReportApp): GroupTone[] {
  return [
    ...app.groups.map((group) => group.tone),
    ...app.competitors.flatMap(groupTones),
  ];
}

export function toneOf(tones: readonly GroupTone[]): ReportTone {
  const up = tones.includes('up');
  const down = tones.includes('down');
  if (up && down) return 'mixed';
  if (up) return 'up';
  if (down) return 'down';
  return 'neutral';
}

export function appTone(app: ReportApp): ReportTone {
  return toneOf(groupTones(app));
}

export function buildReport(
  payload: AlertBatchPayload,
  origin: string | null,
  caps: ReportCaps = DEFAULT_CAPS,
): AlertReport {
  const build = { links: reportLinks(origin), caps };
  const sections = payload.apps.slice(0, caps.apps);
  const apps = sections.map((section) =>
    reportApp(section, payload.scope, build),
  );
  return {
    kind: 'batch',
    event: payload.event,
    ...headlineOf(payload),
    tone: toneOf(apps.flatMap(groupTones)),
    occurredAt: payload.occurredAt,
    window: payload.window,
    dateLabel: formatUtcDateRange(payload.window.from, payload.window.to),
    link: build.links.home,
    apps,
    omittedApps: payload.apps.length - sections.length,
    facts: [],
  };
}

export interface ReportCounts {
  rankDrops: number;
  rankImprovements: number;
  milestones: number;
  firstRankings: number;
  overtakes: number;
  serpEntrants: number;
  changes: number;
  negativeReviews: number;
  actions: number;
}

export function reportCounts(payload: AlertBatchPayload): ReportCounts {
  const count = (pick: (section: Section) => readonly unknown[] | undefined) =>
    payload.apps.reduce(
      (sum, section) => sum + (pick(section) ?? []).length,
      0,
    );
  return {
    rankDrops: count((section) => section.rankDrops),
    rankImprovements: count((section) => section.rankImprovements),
    milestones: count((section) => section.rankMilestones),
    firstRankings: count((section) => section.firstRankings),
    overtakes: count((section) => section.overtakes),
    serpEntrants: count((section) => section.serpEntrants),
    changes: count((section) => section.changes),
    negativeReviews: count((section) => section.negativeReviews),
    actions: count((section) => section.actions),
  };
}
