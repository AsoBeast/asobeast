import type { ShareOfVoicePoint, VisibilityHistory } from "@asobeast/shared";
import { valueAxis, type ValueAxis } from "@/components/charts/trend-axis";

export interface ShareRow {
  date: string;
  share?: number;
  nonBranded?: number;
  competitors: number;
}

const byDate = (points: readonly ShareOfVoicePoint[] | undefined) =>
  new Map((points ?? []).map((point) => [point.date, point]));

export function shareSeries(history: VisibilityHistory): ShareRow[] {
  const all = byDate(history.shareOfVoice);
  const nonBranded = byDate(history.nonBrandedShareOfVoice);
  return [...new Set([...all.keys(), ...nonBranded.keys()])]
    .sort()
    .map((date) => {
      const share = all.get(date);
      const plain = nonBranded.get(date);
      return {
        date,
        ...(share ? { share: share.share } : {}),
        ...(plain ? { nonBranded: plain.share } : {}),
        competitors: share?.competitors ?? plain?.competitors ?? 0,
      };
    });
}

export const hasNonBranded = (rows: readonly ShareRow[]): boolean =>
  rows.some(
    (row) => row.nonBranded !== undefined && row.nonBranded !== row.share,
  );

const FULL_SHARE = 100;
const HEADROOM = 1.25;

export function shareAxis(rows: readonly ShareRow[]): ValueAxis {
  const values = rows.flatMap((row) =>
    [row.share, row.nonBranded].filter((value) => value !== undefined),
  );
  return valueAxis([
    0,
    Math.min(FULL_SHARE, Math.max(0, ...values) * HEADROOM),
  ]);
}
