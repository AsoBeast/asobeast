import type { EssentialAlertsNeed } from '@asobeast/shared';

export function essentialAlertsNeed(
  mailEnabled: boolean,
  origin: string | null,
): EssentialAlertsNeed | null {
  if (!mailEnabled) return 'smtp';
  return origin?.startsWith('https://') ? null : 'https';
}
