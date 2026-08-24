export interface VisibilityKeyword {
  traffic: number | null;
  position: number | null;
}

export const positionWeight = (position: number | null): number =>
  position === null ? 0 : 1 / Math.log2(position + 1);

export const visibility = (keywords: VisibilityKeyword[]): number => {
  let weighted = 0;
  let total = 0;
  for (const keyword of keywords) {
    const traffic = keyword.traffic ?? 1;
    weighted += traffic * positionWeight(keyword.position);
    total += traffic;
  }
  return total === 0 ? 0 : Math.round((weighted / total) * 1000) / 10;
};
