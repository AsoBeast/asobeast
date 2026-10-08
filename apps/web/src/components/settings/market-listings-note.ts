export function marketListingsNote(count: number | undefined): string | null {
  if (count === undefined || count === 0) return null;
  const verb = count === 1 ? "refreshes" : "refresh";
  return `${count} of the app requests ${verb} the listing of a market you track keywords in.`;
}
