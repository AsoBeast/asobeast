import type { Page } from "@playwright/test";

const REVEAL_AFTER_LOAD_MS = 1000;
const HELD_REVEALS = "__asobeastHeldReveals";

export async function revealAfterLoad(
  page: Page,
): Promise<() => Promise<number>> {
  await page.addInitScript(
    ({ delay, counter }) => {
      const held = window as unknown as Record<string, number>;
      held[counter] = 0;
      let reveal: ((batch: unknown) => void) | undefined;
      Object.defineProperty(window, "$RV", {
        configurable: true,
        get: () =>
          reveal &&
          ((batch: unknown) => {
            held[counter] += 1;
            const later = () => setTimeout(() => reveal?.(batch), delay);
            if (document.readyState === "complete") later();
            else window.addEventListener("load", later, { once: true });
          }),
        set: (value: (batch: unknown) => void) => {
          reveal = value;
        },
      });
    },
    { delay: REVEAL_AFTER_LOAD_MS, counter: HELD_REVEALS },
  );
  return () =>
    page.evaluate(
      (counter) => (window as unknown as Record<string, number>)[counter],
      HELD_REVEALS,
    );
}
