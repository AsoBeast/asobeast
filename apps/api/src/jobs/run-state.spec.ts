import { RUN_DELAYED_AFTER_HOURS, runStateOf } from './run-state';

describe('runStateOf', () => {
  it('is idle when the workspace tracks nothing', () => {
    expect(runStateOf({ tracked: 0, captured: 0, hoursSinceTrigger: 23 })).toBe(
      'idle',
    );
  });

  it('is complete once every tracked keyword was captured', () => {
    expect(
      runStateOf({ tracked: 40, captured: 40, hoursSinceTrigger: 1 }),
    ).toBe('complete');
  });

  it('is running while the captures are still landing', () => {
    expect(
      runStateOf({ tracked: 40, captured: 10, hoursSinceTrigger: 1 }),
    ).toBe('running');
  });

  it('is delayed at the grace boundary, not after it', () => {
    expect(
      runStateOf({
        tracked: 40,
        captured: 10,
        hoursSinceTrigger: RUN_DELAYED_AFTER_HOURS,
      }),
    ).toBe('delayed');
    expect(
      runStateOf({
        tracked: 40,
        captured: 10,
        hoursSinceTrigger: RUN_DELAYED_AFTER_HOURS - 0.1,
      }),
    ).toBe('running');
  });

  it('never calls a finished run delayed', () => {
    expect(
      runStateOf({ tracked: 40, captured: 41, hoursSinceTrigger: 23 }),
    ).toBe('complete');
  });
});
