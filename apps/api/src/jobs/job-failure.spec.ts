import type { Job } from 'bullmq';
import type { ErrorTracking } from '../observability/error-tracking.service';
import { reportJobFailure } from './job-failure';

function jobOf(finishedOn: number | undefined): Job {
  return {
    name: 'check-keyword',
    queueName: 'gplay',
    finishedOn,
    data: { workspaceId: 'ws_a', keywordId: 'kw_1' },
  } as unknown as Job;
}

describe('reportJobFailure', () => {
  let tracking: { capture: jest.Mock };

  beforeEach(() => {
    tracking = { capture: jest.fn() };
  });

  function report(job: Job | undefined, tags?: Record<string, string>): void {
    reportJobFailure(
      tracking as unknown as ErrorTracking,
      job,
      new Error('parser broke'),
      tags,
    );
  }

  it('stays quiet while the retry chain still has attempts left', () => {
    report(jobOf(undefined));

    expect(tracking.capture).not.toHaveBeenCalled();
  });

  it('reports an exhausted chain once, with no job payload', () => {
    report(jobOf(1_760_000_000_000), { store: 'GOOGLE_PLAY' });

    expect(tracking.capture).toHaveBeenCalledTimes(1);
    const [error, context] = tracking.capture.mock.calls[0] as [
      Error,
      { transaction: string; tags: Record<string, string> },
    ];
    expect(error.message).toBe('parser broke');
    expect(context).toEqual({
      transaction: 'check-keyword',
      tags: {
        job: 'check-keyword',
        queue: 'gplay',
        store: 'GOOGLE_PLAY',
      },
    });
    expect(JSON.stringify(context)).not.toContain('kw_1');
  });

  it('reports a failure that carries no job at all', () => {
    report(undefined);

    expect(tracking.capture).toHaveBeenCalledWith(expect.any(Error), {
      tags: {},
    });
  });
});
