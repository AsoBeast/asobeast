export function windowKey(
  namespace: string,
  scope: string,
  label: string,
  windowSeconds: number,
  now: Date,
): string {
  const bucket = Math.floor(now.getTime() / (windowSeconds * 1000));
  return `asobeast:${namespace}:${scope}:${label}:${bucket}`;
}

export function secondsUntilReset(windowSeconds: number, now: Date): number {
  const elapsed = Math.floor(now.getTime() / 1000) % windowSeconds;
  return windowSeconds - elapsed;
}
