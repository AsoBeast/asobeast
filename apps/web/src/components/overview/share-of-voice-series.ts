import type { ShareOfVoicePoint, VisibilityHistory } from "@asobeast/shared";

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

export const hasNonBranded = (history: VisibilityHistory): boolean =>
  shareSeries(history).some(
    (row) => row.nonBranded !== undefined && row.nonBranded !== row.share,
  );

const FULL_SHARE = 100;
const HEADROOM = 1.25;
const MAX_TICK_GAPS = 4;
const TICK_STEPS = [1, 2, 5, 10, 20, 25] as const;

export interface ShareAxis {
  domain: [number, number];
  ticks: number[];
}

export function shareAxis(rows: readonly ShareRow[]): ShareAxis {
  const values = rows.flatMap((row) =>
    [row.share, row.nonBranded].filter((value) => value !== undefined),
  );
  const top = Math.min(FULL_SHARE, Math.max(0, ...values) * HEADROOM);
  const step =
    TICK_STEPS.find((each) => Math.ceil(top / each) <= MAX_TICK_GAPS) ??
    TICK_STEPS[TICK_STEPS.length - 1];
  const to = Math.min(FULL_SHARE, Math.max(1, Math.ceil(top / step)) * step);
  const ticks = Array.from(
    { length: Math.floor(to / step) + 1 },
    (_, index) => index * step,
  );
  return { domain: [0, to], ticks };
}
