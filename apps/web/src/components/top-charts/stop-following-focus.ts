import { survivingNeighbour } from "@/lib/focus-handoff";

const STOP_BUTTONS = 'button[aria-label^="Stop following"]';
const POPOVER = '[data-slot="popover-content"]';

export function stopFollowingSuccessor(
  stopped: HTMLElement | null,
): HTMLElement | null {
  const popover = stopped?.closest<HTMLElement>(POPOVER) ?? null;
  const stops = [
    ...(popover?.querySelectorAll<HTMLElement>(STOP_BUTTONS) ?? []),
  ];
  return survivingNeighbour(stops, (button) => button === stopped) ?? popover;
}
