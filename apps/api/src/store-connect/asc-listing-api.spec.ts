import { AscListingApi } from './asc-listing-api';
import { AscError } from './asc-errors';
import type { AscResponse } from './asc-transport';
import { failure, ok, recordedRequester } from './asc-transport.fixture';

interface VersionEntry {
  state: string;
  version: string;
  createdDate: string;
}

const versions = (entries: VersionEntry[]): AscResponse =>
  ok({
    data: entries.map((entry, index) => ({
      id: String(900 - index),
      type: 'appStoreVersions',
      attributes: {
        appStoreState: entry.state,
        versionString: entry.version,
        createdDate: entry.createdDate,
      },
    })),
    links: {},
  });

const localizations = (locales: string[]): AscResponse =>
  ok({
    data: locales.map((locale) => ({
      id: `loc-${locale}`,
      type: 'appStoreVersionLocalizations',
      attributes: { locale, keywords: locale === 'empty' ? '' : 'focus,timer' },
    })),
    links: {},
  });

function recorded(...responses: AscResponse[]) {
  const { requester, requests } = recordedRequester(...responses);
  return { api: new AscListingApi(requester), requests };
}

describe('AscListingApi.liveVersion', () => {
  it('reads the live ios version for the app', async () => {
    const { api, requests } = recorded(
      versions([
        {
          state: 'READY_FOR_SALE',
          version: '2.0',
          createdDate: '2026-01-15T10:00:00.000Z',
        },
      ]),
    );

    await expect(api.liveVersion('1476097583')).resolves.toEqual({
      id: '900',
      version: '2.0',
    });
    expect(requests[0]).toMatchObject({
      method: 'GET',
      path: '/v1/apps/1476097583/appStoreVersions?filter[appStoreState]=READY_FOR_SALE&filter[platform]=IOS&fields[appStoreVersions]=versionString,createdDate&limit=200',
    });
  });

  it('takes the newest live version when Apple answers several', async () => {
    const { api } = recorded(
      versions([
        {
          state: 'READY_FOR_SALE',
          version: '1.9',
          createdDate: '2025-06-01T10:00:00.000Z',
        },
        {
          state: 'READY_FOR_SALE',
          version: '2.0',
          createdDate: '2026-01-15T10:00:00.000Z',
        },
      ]),
    );

    await expect(api.liveVersion('1476097583')).resolves.toEqual({
      id: '899',
      version: '2.0',
    });
  });

  it('answers null when no version is live', async () => {
    const { api } = recorded(failure(404, 'NOT_FOUND'));

    await expect(api.liveVersion('1476097583')).rejects.toThrow(AscError);
  });
});

describe('AscListingApi.versionLocalizations', () => {
  it('reads locale and keywords per localization', async () => {
    const { api, requests } = recorded(localizations(['en-US', 'de-DE']));

    await expect(api.versionLocalizations('900')).resolves.toEqual([
      { locale: 'en-US', keywords: 'focus,timer' },
      { locale: 'de-DE', keywords: 'focus,timer' },
    ]);
    expect(requests[0].path).toBe(
      '/v1/appStoreVersions/900/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,keywords&limit=200',
    );
  });

  it('reads an empty keyword field as an empty string', async () => {
    const { api } = recorded(localizations(['empty']));

    await expect(api.versionLocalizations('900')).resolves.toEqual([
      { locale: 'empty', keywords: '' },
    ]);
  });
});
