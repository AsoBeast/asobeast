import {
  ShareOfVoice,
  ShareOfVoicePoint,
  ShareOfVoiceReason,
} from '@asobeast/shared';
import {
  addDays,
  capturedOn,
  Ranking,
  toDateKey,
  TrackedRow,
  visibilityAt,
} from './analytics.support';

export const SHARE_DELTA_DAYS = 7;

export interface VoiceShare {
  share: number | null;
  counted: number;
  reason?: ShareOfVoiceReason;
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

export const rivalRows = (
  rows: readonly TrackedRow[],
  rankings: ReadonlyMap<string, Ranking[]>,
): TrackedRow[] =>
  rows.map((row) => ({
    ...row,
    keyword: { ...row.keyword, rankings: rankings.get(row.keywordId) ?? [] },
  }));

export function shareAt(
  rows: readonly TrackedRow[],
  rivals: readonly (readonly TrackedRow[])[],
  date: Date,
): VoiceShare {
  if (rivals.length === 0) {
    return { share: null, counted: 0, reason: 'noCompetitors' };
  }
  if (rows.length === 0) {
    return { share: null, counted: 0, reason: 'nobodyRanks' };
  }
  const checked = rivals.filter((rival) => capturedOn([...rival], date));
  if (checked.length === 0) {
    return { share: null, counted: 0, reason: 'notChecked' };
  }
  const you = visibilityAt([...rows], date);
  const total = checked.reduce(
    (sum, rival) => sum + visibilityAt([...rival], date),
    you,
  );
  const counted = checked.length;
  return total === 0
    ? { share: null, counted, reason: 'nobodyRanks' }
    : { share: round1((you / total) * 100), counted };
}

export function shareOfVoiceSummary(
  rows: readonly TrackedRow[],
  rivals: readonly (readonly TrackedRow[])[],
  referenceDate: Date | null,
): ShareOfVoice {
  if (referenceDate === null) {
    return {
      current: null,
      delta7d: null,
      competitors: 0,
      reason: rivals.length === 0 ? 'noCompetitors' : 'notChecked',
    };
  }
  const now = shareAt(rows, rivals, referenceDate);
  const pastDate = addDays(referenceDate, -SHARE_DELTA_DAYS);
  const past = capturedOn([...rows], pastDate)
    ? shareAt(rows, rivals, pastDate).share
    : null;
  return {
    current: now.share,
    delta7d:
      now.share !== null && past !== null ? round1(now.share - past) : null,
    competitors: now.counted,
    ...(now.share === null && now.reason ? { reason: now.reason } : {}),
  };
}

const rankingDates = (rows: readonly TrackedRow[]): Date[] =>
  [
    ...new Set(
      rows.flatMap((row) =>
        row.keyword.rankings.map((ranking) => ranking.date.getTime()),
      ),
    ),
  ]
    .sort((a, b) => a - b)
    .map((time) => new Date(time));

export function shareOfVoicePoints(
  rows: readonly TrackedRow[],
  rivals: readonly (readonly TrackedRow[])[],
): ShareOfVoicePoint[] {
  return rankingDates(rows).flatMap((date) => {
    const { share, counted } = shareAt(rows, rivals, date);
    return share === null
      ? []
      : [{ date: toDateKey(date), share, competitors: counted }];
  });
}
