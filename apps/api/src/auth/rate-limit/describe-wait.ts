const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SHORTEST_WAIT_SECONDS = 1;

function counted(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function wholeSeconds(seconds: number): number {
  return Number.isFinite(seconds)
    ? Math.max(SHORTEST_WAIT_SECONDS, Math.ceil(seconds))
    : SHORTEST_WAIT_SECONDS;
}

export function describeWait(seconds: number): string {
  const wait = wholeSeconds(seconds);
  if (wait < SECONDS_PER_MINUTE) return counted(wait, 'second');

  const totalMinutes = Math.ceil(wait / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const parts = [
    hours > 0 ? counted(hours, 'hour') : null,
    minutes > 0 ? counted(minutes, 'minute') : null,
  ];
  return parts.filter((part) => part !== null).join(' ');
}
