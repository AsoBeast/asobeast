export async function untilStable(
  read: () => string,
  moving: () => boolean,
  pause: () => Promise<void>,
  maxChecks: number,
): Promise<string> {
  let previous = read();
  for (let check = 0; check < maxChecks; check += 1) {
    await pause();
    const current = read();
    if (current === previous && !moving()) return current;
    previous = current;
  }
  return previous;
}
