export const POSITION_BANDS = [
  { max: 3, token: "var(--rank-band-1)", label: "top 3" },
  { max: 10, token: "var(--rank-band-2)", label: "top 10" },
  { max: 25, token: "var(--rank-band-3)", label: "top 25" },
  { max: 50, token: "var(--rank-band-4)", label: "top 50" },
  { max: Infinity, token: "var(--rank-band-5)", label: "beyond 50" },
] as const;

export interface PositionBand {
  token: string;
  label: string;
}

export function positionBand(position: number | null): PositionBand | null {
  if (position === null) return null;
  const band = POSITION_BANDS.find((candidate) => position <= candidate.max);
  return band ? { token: band.token, label: band.label } : null;
}
