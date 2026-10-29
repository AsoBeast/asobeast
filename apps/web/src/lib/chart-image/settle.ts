export async function untilStable(
  read: () => string,
  pause: () => Promise<void>,
  maxChecks: number,
): Promise<string> {
  let previous = read();
  for (let check = 0; check < maxChecks; check += 1) {
    await pause();
    const current = read();
    if (current === previous) return current;
    previous = current;
  }
  return previous;
}
