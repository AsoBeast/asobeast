const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;

function counted(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

export function describeWait(seconds: number): string {
  if (seconds < SECONDS_PER_MINUTE) return counted(seconds, 'second');

  const totalMinutes = Math.ceil(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const parts = [
    hours > 0 ? counted(hours, 'hour') : null,
    minutes > 0 ? counted(minutes, 'minute') : null,
  ];
  return parts.filter((part) => part !== null).join(' ');
}
