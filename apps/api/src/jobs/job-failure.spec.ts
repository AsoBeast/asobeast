import { reportJobFailure } from './job-failure';

function jobOf(finishedOn: number | undefined) {
  return {
    name: 'check-keyword',
    queueName: 'gplay',
    finishedOn,
    data: { workspaceId: 'ws_a', keywordId: 'kw_1' },
  };
}

describe('reportJobFailure', () => {
  const capture = jest.fn();
  const error = new Error('parser broke');

  beforeEach(() => capture.mockClear());

  it('stays quiet while the retry chain still has attempts left', () => {
    reportJobFailure({ capture }, jobOf(undefined), error);

    expect(capture).not.toHaveBeenCalled();
  });

  it('reports an exhausted chain once, with no job payload', () => {
    reportJobFailure({ capture }, jobOf(1_760_000_000_000), error, {
      store: 'GOOGLE_PLAY',
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture).toHaveBeenCalledWith(error, {
      transaction: 'check-keyword',
      tags: { job: 'check-keyword', queue: 'gplay', store: 'GOOGLE_PLAY' },
    });
    expect(JSON.stringify(capture.mock.calls)).not.toContain('kw_1');
  });

  it('reports a failure that carries no job at all', () => {
    reportJobFailure({ capture }, undefined, error);

    expect(capture).toHaveBeenCalledWith(error, { tags: {} });
  });
});
