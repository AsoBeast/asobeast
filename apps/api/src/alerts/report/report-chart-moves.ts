import {
  CHART_COLLECTION_TITLES,
  type ChartMovePayload,
  type ChartMoveScope,
} from '@asobeast/shared';
import type { GroupTone, ReportRow } from './report';
import { milestonePhrase, rankCell } from './report-rows';

export const chartName = (chart: ChartMoveScope): string =>
  `${CHART_COLLECTION_TITLES[chart.collection]} · ${chart.genreName}`;

export const chartLabel = (chart: ChartMoveScope): string =>
  `${chartName(chart)} (${chart.country.toUpperCase()})`;

export interface ChartMoveEntry {
  move: ChartMovePayload;
  notes: string[];
}

const EDGE_NOTES = {
  'chart.entered': 'entered the chart',
  'chart.left': 'left the chart',
} as const;

const noteOf = (move: ChartMovePayload): string =>
  move.event === 'chart.milestone'
    ? milestonePhrase(move.tier, move.direction)
    : EDGE_NOTES[move.event];

const entryKey = (move: ChartMovePayload): string =>
  `${move.chart.collection}~${move.chart.genre}~${move.date}`;

const edgeFirst = (left: ChartMovePayload, right: ChartMovePayload): number =>
  Number(left.event === 'chart.milestone') -
  Number(right.event === 'chart.milestone');

export function mergeChartMoves(
  moves: readonly ChartMovePayload[],
): ChartMoveEntry[] {
  const entries = new Map<string, ChartMoveEntry>();
  for (const move of [...moves].sort(edgeFirst)) {
    const entry = entries.get(entryKey(move));
    if (entry) entry.notes.push(noteOf(move));
    else entries.set(entryKey(move), { move, notes: [noteOf(move)] });
  }
  return [...entries.values()];
}

export function chartMoveRows(moves: readonly ChartMovePayload[]): ReportRow[] {
  return mergeChartMoves(moves).map(({ move, notes }) => ({
    kind: 'move',
    label: chartName(move.chart),
    from: rankCell(move.from, move.depth),
    to: rankCell(move.to, move.depth),
    note: notes.join(' · '),
  }));
}

const isGain = (move: ChartMovePayload): boolean =>
  move.event === 'chart.entered' ||
  (move.event === 'chart.milestone' && move.direction === 'entered');

export function chartMoveTone(moves: readonly ChartMovePayload[]): GroupTone {
  const gains = moves.filter(isGain).length;
  if (gains === moves.length) return 'up';
  return gains === 0 ? 'down' : 'neutral';
}
