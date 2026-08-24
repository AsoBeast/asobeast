export const TRUSTED_PROXY_HOPS_MAX = 10;

const BOOLEAN_TRUE_HOPS = 1;
const DIGITS = /^\d+$/;

export function trustedProxyHops(value: string | undefined): number {
  if (value === undefined) return 0;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized === 'false') return 0;
  if (normalized === 'true') return BOOLEAN_TRUE_HOPS;
  if (!DIGITS.test(normalized)) return Number.NaN;
  const hops = Number(normalized);
  return hops > TRUSTED_PROXY_HOPS_MAX ? Number.NaN : hops;
}
