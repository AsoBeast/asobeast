import { ASC_RETRY_PAUSE_MS } from './asc-requester';
import {
  AscError,
  AscRateLimitedError,
  AscRejectedKeyError,
} from './asc-errors';
import {
  ascFixture,
  failure,
  ok,
  recordedRequester,
} from './asc-transport.fixture';

const instancesPage1 = ascFixture('instances-page-1');
const instancesPage2 = ascFixture('instances-page-2');

const read = { method: 'GET', path: '/v1/apps?filter[id]=111' } as const;

describe('AscRequester.page', () => {
  it('paginates with the cursor Apple returns', async () => {
    const { requester, requests } = recordedRequester(
      ok(instancesPage1),
      ok(instancesPage2),
    );

    await requester.page(
      '/v1/analyticsReports/r-engagement-standard/instances?filter[granularity]=DAILY&limit=200',
    );

    expect(requests[1].path).toBe(
      '/v1/analyticsReports/r-engagement-standard/instances?filter%5Bgranularity%5D=DAILY&cursor=Mg.AJ8&limit=200',
    );
  });
});

describe('AscRequester.page on an answer it cannot read', () => {
  it.each([
    ['an empty or unparsable body', null],
    ['an object without data', {}],
    ['an error document with a success status', { errors: [] }],
    ['data that is not a list', { data: {} }],
    ['data that is text', { data: 'x' }],
    ['a list instead of a document', []],
  ])('refuses %s', async (_, body) => {
    const { requester } = recordedRequester(ok(body));

    await expect(requester.page(read.path)).rejects.toEqual(
      new AscError(
        'App Store Connect answered with something AsoBeast could not read',
        502,
        null,
      ),
    );
  });

  it('reads an empty data list as a page with nothing on it', async () => {
    const { requester } = recordedRequester(ok({ data: [] }));

    await expect(requester.page(read.path)).resolves.toEqual([]);
  });

  it('refuses a later page it cannot read', async () => {
    const { requester } = recordedRequester(ok(instancesPage1), ok(null));

    await expect(
      requester.page(
        '/v1/analyticsReports/r-engagement-standard/instances?filter[granularity]=DAILY&limit=200',
      ),
    ).rejects.toBeInstanceOf(AscError);
  });
});

describe('AscRequester.send', () => {
  it('retries a 500 once after the pause and then throws', async () => {
    const { requester, requests, pause } = recordedRequester(
      failure(500, 'UNEXPECTED_ERROR'),
      failure(500, 'UNEXPECTED_ERROR'),
    );

    await expect(requester.send(read)).rejects.toMatchObject({
      status: 500,
    });
    expect(requests).toHaveLength(2);
    expect(pause).toHaveBeenCalledWith(ASC_RETRY_PAUSE_MS);
    expect(ASC_RETRY_PAUSE_MS).toBe(2_000);
  });

  it('throws a rate limit error on 429 without retrying', async () => {
    const { requester, requests } = recordedRequester(
      failure(429, 'RATE_LIMIT_EXCEEDED'),
    );

    await expect(requester.send(read)).rejects.toBeInstanceOf(
      AscRateLimitedError,
    );
    expect(requests).toHaveLength(1);
  });

  it.each([401, 403])(
    'throws a rejected key error on %i from a read',
    async (status) => {
      const { requester } = recordedRequester(
        failure(status, 'NOT_AUTHORIZED'),
      );

      await expect(requester.send(read)).rejects.toBeInstanceOf(
        AscRejectedKeyError,
      );
    },
  );
});
