import {
  addUtcDays,
  CompetitorThreatKind,
  GAP_TOP,
  isCheckFresh,
  THREAT_WINDOW_DAYS,
  THREAT_WITHIN,
} from '@asobeast/shared';
import { overtaken } from '../rankings/rank-milestones';

export interface Check {
  date: string;
  position: number | null;
}

export type CheckSeries = readonly Check[];

export interface Rival {
  id: string;
  series: CheckSeries;
}

export interface Threat {
  kind: CompetitorThreatKind;
  competitorId: string;
  competitorPosition: number;
  competitorDelta: number | null;
  overtookOn: string | null;
}

export interface ThreatInput {
  you: CheckSeries;
  rivals: readonly Rival[];
  today: string;
}

interface RankedCheck {
  date: string;
  position: number;
}

export function overtookOn(
  you: CheckSeries,
  rival: CheckSeries,
  since: string,
): string | null {
  const rivalOn = new Map(rival.map((check) => [check.date, check.position]));
  for (let index = 0; index + 1 < you.length; index += 1) {
    const later = you[index];
    const earlier = you[index + 1];
    if (later.date < since) return null;
    const rivalLater = rivalOn.get(later.date);
    const rivalEarlier = rivalOn.get(earlier.date);
    if (rivalLater === undefined || rivalEarlier === undefined) continue;
    const passed = overtaken(
      { app: earlier.position, competitor: rivalEarlier },
      { app: later.position, competitor: rivalLater },
    );
    if (passed) return later.date;
  }
  return null;
}

const freshRanked = (
  check: Check | undefined,
  today: string,
): check is RankedCheck =>
  check !== undefined &&
  check.position !== null &&
  isCheckFresh(check.date, today);

function rivalThreat(
  you: CheckSeries,
  app: RankedCheck,
  rival: Rival,
  today: string,
): Threat | null {
  const [head, previous] = rival.series;
  if (!freshRanked(head, today)) return null;
  const competitorDelta =
    previous === undefined || previous.position === null
      ? null
      : previous.position - head.position;
  const threat = { competitorId: rival.id, competitorPosition: head.position };
  if (head.position < app.position) {
    const since = addUtcDays(today, -THREAT_WINDOW_DAYS);
    const passedOn = overtookOn(you, rival.series, since);
    return passedOn === null
      ? null
      : { ...threat, kind: 'overtook', competitorDelta, overtookOn: passedOn };
  }
  const closing =
    head.position > app.position &&
    head.position - app.position <= THREAT_WITHIN &&
    previous !== undefined &&
    (previous.position === null || head.position < previous.position);
  return closing
    ? { ...threat, kind: 'closing', competitorDelta, overtookOn: null }
    : null;
}

const KIND_ORDER: Record<CompetitorThreatKind, number> = {
  overtook: 0,
  closing: 1,
};

function byStrength(a: Threat, b: Threat): number {
  if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (a.kind === 'overtook') {
    const later = (b.overtookOn ?? '').localeCompare(a.overtookOn ?? '');
    return later || a.competitorPosition - b.competitorPosition;
  }
  return (
    a.competitorPosition - b.competitorPosition ||
    biggerRiseFirst(a.competitorDelta, b.competitorDelta)
  );
}

function biggerRiseFirst(a: number | null, b: number | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b - a;
}

export function strongestThreat({
  you,
  rivals,
  today,
}: ThreatInput): Threat | null {
  const [app] = you;
  if (!freshRanked(app, today) || app.position > GAP_TOP) return null;
  const threats = rivals.flatMap((rival) => {
    const threat = rivalThreat(you, app, rival, today);
    return threat === null ? [] : [threat];
  });
  return threats.sort(byStrength)[0] ?? null;
}
