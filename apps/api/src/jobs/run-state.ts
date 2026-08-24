import type { RunState } from '@asobeast/shared';

export const RUN_DELAYED_AFTER_HOURS = 20;

export function runStateOf(input: {
  tracked: number;
  captured: number;
  hoursSinceTrigger: number;
}): RunState {
  if (input.tracked === 0) return 'idle';
  if (input.captured >= input.tracked) return 'complete';
  return input.hoursSinceTrigger >= RUN_DELAYED_AFTER_HOURS
    ? 'delayed'
    : 'running';
}
