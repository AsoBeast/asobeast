const MB_PER_GB = 1024;

export interface ResidentialTariff {
  mbPerRequest: number;
  costPerGb: number;
  monthlyCapUsd: number;
}

export function spendUsd(requests: number, tariff: ResidentialTariff): number {
  return (requests * tariff.mbPerRequest * tariff.costPerGb) / MB_PER_GB;
}

const REQUEST_CEILING = 2_147_483_647;

export function maxRequests(tariff: ResidentialTariff): number {
  if (tariff.monthlyCapUsd <= 0) return 0;
  const perRequest = spendUsd(1, tariff);
  if (perRequest <= 0) return REQUEST_CEILING;
  return Math.min(
    Math.floor(tariff.monthlyCapUsd / perRequest),
    REQUEST_CEILING,
  );
}

export function spendMonth(now = new Date()): string {
  return now.toISOString().slice(0, 7);
}
