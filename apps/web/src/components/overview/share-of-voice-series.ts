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
  history.nonBrandedShareOfVoice !== undefined;
