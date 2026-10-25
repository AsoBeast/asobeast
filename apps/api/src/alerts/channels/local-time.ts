export function unixSeconds(iso: string): number | null {
  const millis = Date.parse(iso);
  return Number.isNaN(millis) ? null : Math.floor(millis / 1000);
}

export type DiscordTimeStyle = 'f' | 'D';

export function discordTime(
  iso: string,
  fallback: string,
  style: DiscordTimeStyle = 'f',
): string {
  const seconds = unixSeconds(iso);
  return seconds === null ? fallback : `<t:${seconds}:${style}>`;
}

export function slackDate(iso: string, fallback: string): string {
  const seconds = unixSeconds(iso);
  return seconds === null
    ? fallback
    : `<!date^${seconds}^{date_short_pretty} at {time}|${fallback}>`;
}

export const utcFallback = (label: string): string => `${label} (UTC)`;
