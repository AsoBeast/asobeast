import type { Store } from '@asobeast/shared';

export type ReportTone = 'up' | 'down' | 'neutral' | 'mixed';
export type GroupTone = Exclude<ReportTone, 'mixed'>;

export interface ReportLink {
  href: string;
  label: string;
}

export interface ReportIdentity {
  name: string;
  iconUrl: string | null;
  store: Store | null;
  country: string | null;
  role: 'primary' | 'competitor';
}

export type ReportRow =
  | {
      kind: 'move';
      label: string;
      from: string;
      to: string;
      note: string | null;
    }
  | { kind: 'text'; text: string; detail: string | null }
  | { kind: 'change'; field: string; before: string; after: string }
  | {
      kind: 'image';
      field: string;
      beforeUrl: string | null;
      afterUrl: string | null;
    };

export const REPORT_GROUP_KINDS = [
  'rankDrops',
  'rankImprovements',
  'milestones',
  'firstRankings',
  'overtakes',
  'chartMoves',
  'serpEntrants',
  'changes',
  'negativeReviews',
  'newReviews',
  'actions',
] as const;
export type ReportGroupKind = (typeof REPORT_GROUP_KINDS)[number];

export interface ReportGroup {
  kind: ReportGroupKind;
  title: string;
  tone: GroupTone;
  rows: ReportRow[];
  total: number;
  link: ReportLink | null;
}

export interface ReportApp {
  id: string;
  identity: ReportIdentity;
  link: ReportLink | null;
  groups: ReportGroup[];
  competitors: ReportApp[];
  omittedCompetitors: number;
  competitorsLink: ReportLink | null;
}

export interface ReportFact {
  label: string;
  value: string;
}

export interface AlertReport {
  kind: 'batch' | 'single';
  event: string;
  headline: string;
  emoji: string;
  tone: ReportTone;
  occurredAt: string;
  window: { from: string; to: string } | null;
  dateLabel: string;
  link: ReportLink | null;
  apps: ReportApp[];
  omittedApps: number;
  facts: ReportFact[];
}
