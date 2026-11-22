import {
  AscAgreementError,
  AscForbiddenError,
  AscRejectedKeyError,
  errorOf,
} from './asc-errors';
import type { AscRequest, AscResponse } from './asc-transport';

const answered = (status: number, code: string): AscResponse => ({
  status,
  body: { errors: [{ status: String(status), code, detail: code }] },
  retryAfter: null,
});

const read: AscRequest = { method: 'GET', path: '/v1/apps/1/customerReviews' };

const VERSION_READ =
  '/v1/apps/1476097583/appStoreVersions?filter[appStoreState]=READY_FOR_SALE&filter[platform]=IOS&fields[appStoreVersions]=versionString,createdDate&limit=200';

const LOCALIZATIONS_READ =
  '/v1/appStoreVersions/v1/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,keywords,promotionalText&limit=200';

describe('errorOf', () => {
  it.each([
    ['GET', '/v1/apps/1/customerReviews?sort=-createdDate&limit=200'],
    ['POST', '/v1/customerReviewResponses'],
    ['DELETE', '/v1/customerReviewResponses/resp-1'],
    ['GET', '/v1/customerReviews/r-1/response'],
    [
      'GET',
      '/v1/nominations?filter[state]=SUBMITTED&filter[relatedApps]=1476097583&limit=200',
    ],
    ['GET', '/v1/nominations'],
    ['GET', VERSION_READ],
    ['GET', LOCALIZATIONS_READ],
  ] as const)(
    'maps a 403 whose code starts with FORBIDDEN on %s %s to a missing role',
    (method, path) => {
      expect(
        errorOf(answered(403, 'FORBIDDEN_ERROR'), { method, path }),
      ).toBeInstanceOf(AscForbiddenError);
    },
  );

  it('maps a 403 on the nominations read to a missing role whatever its code', () => {
    const error = errorOf(answered(403, 'NOT_AUTHORIZED'), {
      method: 'GET',
      path: '/v1/nominations?filter[state]=DRAFT&limit=200',
    });

    expect(error).toBeInstanceOf(AscForbiddenError);
    expect(error).not.toBeInstanceOf(AscRejectedKeyError);
  });

  it('keeps a 403 with another code on a review resource as a rejected key', () => {
    const error = errorOf(answered(403, 'NOT_AUTHORIZED'), read);

    expect(error).toBeInstanceOf(AscRejectedKeyError);
    expect(error).not.toBeInstanceOf(AscForbiddenError);
  });

  it.each([VERSION_READ, LOCALIZATIONS_READ])(
    'keeps a 403 with another code on the version read %s as a rejected key',
    (path) => {
      const error = errorOf(answered(403, 'NOT_AUTHORIZED'), {
        method: 'GET',
        path,
      });

      expect(error).toBeInstanceOf(AscRejectedKeyError);
      expect(error).not.toBeInstanceOf(AscForbiddenError);
    },
  );

  it('names a missing agreement on a version read before a missing role', () => {
    expect(
      errorOf(
        answered(403, 'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED'),
        { method: 'GET', path: LOCALIZATIONS_READ },
      ),
    ).toBeInstanceOf(AscAgreementError);
  });

  it('keeps a FORBIDDEN 403 on an analytics read as a rejected key', () => {
    expect(
      errorOf(answered(403, 'FORBIDDEN_ERROR'), {
        method: 'GET',
        path: '/v1/apps?fields[apps]=name&limit=1',
      }),
    ).toBeInstanceOf(AscRejectedKeyError);
  });

  it('keeps the report creation path case', () => {
    expect(
      errorOf(answered(403, 'NOT_AUTHORIZED'), {
        method: 'POST',
        path: '/v1/analyticsReportRequests',
      }),
    ).toBeInstanceOf(AscForbiddenError);
  });

  it('names a missing agreement before a missing role', () => {
    expect(
      errorOf(
        answered(403, 'FORBIDDEN.REQUIRED_AGREEMENTS_MISSING_OR_EXPIRED'),
        read,
      ),
    ).toBeInstanceOf(AscAgreementError);
  });

  it('keeps a 401 as a rejected key whatever its code', () => {
    expect(errorOf(answered(401, 'FORBIDDEN_ERROR'), read)).toBeInstanceOf(
      AscRejectedKeyError,
    );
  });
});
