import { AscError, AscForbiddenError } from './asc-errors';
import { AscReviewsApi } from './asc-reviews-api';
import {
  ascFixture,
  failure,
  ok,
  recordedRequester,
} from './asc-transport.fixture';
import type { AscResponse } from './asc-transport';

const page1 = ascFixture('customer-reviews-page-1');
const page2 = ascFixture('customer-reviews-page-2');
const response = ascFixture('customer-review-response');

const FIRST_PAGE =
  '/v1/apps/123/customerReviews?filter[territory]=USA&sort=-createdDate&limit=200&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory';

const refusal = (
  status: number,
  code: string,
  detail: string,
): AscResponse => ({
  status,
  body: { errors: [{ status: String(status), code, detail }] },
  retryAfter: null,
});

function recordedWithPause(...responses: AscResponse[]) {
  const { requester, requests, pause } = recordedRequester(...responses);
  return { api: new AscReviewsApi(requester), requests, pause };
}

const recorded = (...responses: AscResponse[]) => {
  const { api, requests } = recordedWithPause(...responses);
  return { api, requests };
};

describe('AscReviewsApi.customerReviews', () => {
  it('lists the customer reviews of a territory newest first and stops at the date given', async () => {
    const { api, requests } = recorded(ok(page1), ok(page2), ok(page1));

    const reviews = await api.customerReviews('123', {
      territory: 'USA',
      until: '2026-09-01T00:00:00Z',
      maxPages: 5,
    });

    expect(requests.map((request) => request.path)).toEqual([
      FIRST_PAGE,
      '/v1/apps/123/customerReviews?filter%5Bterritory%5D=USA&sort=-createdDate&cursor=Mw.AK1&limit=200',
    ]);
    expect(reviews.map((review) => review.id)).toEqual([
      '00000028-b08c-0014-729e-fbd500000001',
      '00000028-b08c-0014-729e-fbd500000002',
      '00000028-b08c-0014-729e-fbd500000003',
      '00000028-b08c-0014-729e-fbd500000004',
      '00000028-b08c-0014-729e-fbd500000005',
    ]);
    expect(reviews[0]).toEqual({
      id: '00000028-b08c-0014-729e-fbd500000001',
      rating: 1,
      title: 'Crashes on launch',
      body: 'Every time I open it the app closes.',
      reviewerNickname: 'sleepless',
      createdDate: '2026-09-05T08:12:00-07:00',
      territory: 'USA',
    });
    expect(reviews[1].title).toBeNull();
  });

  it('keeps reading while the last review sits exactly at the date given', async () => {
    const { api, requests } = recorded(ok(page1), ok(page2));

    await api.customerReviews('123', {
      territory: 'USA',
      until: '2026-09-03T09:00:00-07:00',
      maxPages: 5,
    });

    expect(requests).toHaveLength(2);
  });

  it('lists without a territory filter when none is given', async () => {
    const { api, requests } = recorded(ok({ data: [] }));

    await expect(
      api.customerReviews('123', { territory: null, until: null, maxPages: 1 }),
    ).resolves.toEqual([]);
    expect(requests[0].path).toBe(
      '/v1/apps/123/customerReviews?sort=-createdDate&limit=200&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory',
    );
  });

  it('narrows the list to one rating when given', async () => {
    const { api, requests } = recorded(ok({ data: [] }));

    await api.customerReviews('123', {
      territory: 'USA',
      rating: 1,
      until: null,
      maxPages: 1,
    });

    expect(requests[0].path).toBe(
      '/v1/apps/123/customerReviews?filter[territory]=USA&filter[rating]=1&sort=-createdDate&limit=200&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory',
    );
  });

  it('caps the pages it reads even before the date given', async () => {
    const { api, requests } = recorded(ok(page1), ok(page2));

    await api.customerReviews('123', {
      territory: 'USA',
      until: '2020-01-01T00:00:00Z',
      maxPages: 1,
    });

    expect(requests).toHaveLength(1);
  });

  it('caps the pages it reads', async () => {
    const { api, requests } = recorded(ok(page1), ok(page2), ok(page1));

    await api.customerReviews('123', {
      territory: 'USA',
      until: null,
      maxPages: 2,
    });

    expect(requests).toHaveLength(2);
  });

  it('reads a 403 on the review list as a missing role', async () => {
    const { api } = recorded(
      refusal(403, 'FORBIDDEN_ERROR', 'This request is forbidden.'),
    );

    await expect(
      api.customerReviews('123', {
        territory: 'USA',
        until: null,
        maxPages: 1,
      }),
    ).rejects.toBeInstanceOf(AscForbiddenError);
  });
});

describe('AscReviewsApi.respond', () => {
  it('responds to a review', async () => {
    const { api, requests } = recorded(ok(response, 201));

    await expect(
      api.respond('00000028-b08c-0014-729e-fbd500000001', 'Thank you'),
    ).resolves.toEqual({
      id: 'f4a1c2d3-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
      state: 'PENDING_PUBLISH',
      lastModifiedDate: '2026-10-21T09:00:00-07:00',
    });
    expect(requests[0]).toMatchObject({
      method: 'POST',
      path: '/v1/customerReviewResponses',
      body: {
        data: {
          type: 'customerReviewResponses',
          attributes: { responseBody: 'Thank you' },
          relationships: {
            review: {
              data: {
                type: 'customerReviews',
                id: '00000028-b08c-0014-729e-fbd500000001',
              },
            },
          },
        },
      },
    });
  });

  it('sends a response once even when apple answers a server error', async () => {
    const { api, requests, pause } = recordedWithPause(
      failure(503, 'UNAVAILABLE'),
      ok(response, 201),
    );

    await expect(api.respond('r', 'Thank you')).rejects.toMatchObject({
      status: 503,
    });
    expect(requests).toHaveLength(1);
    expect(pause).not.toHaveBeenCalled();
  });

  it('reads a 403 on a response as a missing role', async () => {
    const { api } = recorded(failure(403, 'FORBIDDEN_ERROR'));

    await expect(api.respond('r', 'Thank you')).rejects.toBeInstanceOf(
      AscForbiddenError,
    );
  });

  it.each([409, 422])(
    "reads a %i on a response as the store's refusal with apple's detail",
    async (status) => {
      const { api } = recorded(
        refusal(status, 'ENTITY_ERROR', 'The response body is invalid.'),
      );

      const error: unknown = await api
        .respond('r', 'Thank you')
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(AscError);
      expect(error).not.toBeInstanceOf(AscForbiddenError);
      expect(error).toMatchObject({
        status,
        message: 'The response body is invalid.',
      });
    },
  );

  it('refuses an answer that names no response', async () => {
    const { api } = recorded(ok({}, 201));

    await expect(api.respond('r', 'Thank you')).rejects.toMatchObject({
      status: 502,
    });
  });
});

describe('AscReviewsApi.deleteResponse', () => {
  it('treats a response apple no longer has as deleted', async () => {
    const { api } = recorded(failure(404, 'NOT_FOUND'));

    await expect(api.deleteResponse('resp-1')).resolves.toBeUndefined();
  });

  it('deletes once even when apple answers a server error', async () => {
    const { api, requests } = recorded(
      failure(503, 'UNAVAILABLE'),
      ok(null, 204),
    );

    await expect(api.deleteResponse('resp-1')).rejects.toMatchObject({
      status: 503,
    });
    expect(requests).toHaveLength(1);
  });

  it('keeps a refused delete as a missing role', async () => {
    const { api } = recorded(failure(403, 'FORBIDDEN_ERROR'));

    await expect(api.deleteResponse('resp-1')).rejects.toBeInstanceOf(
      AscForbiddenError,
    );
  });

  it('deletes a response', async () => {
    const { api, requests } = recorded(ok(null, 204));

    await expect(api.deleteResponse('resp-1')).resolves.toBeUndefined();
    expect(requests[0]).toMatchObject({
      method: 'DELETE',
      path: '/v1/customerReviewResponses/resp-1',
    });
  });
});
