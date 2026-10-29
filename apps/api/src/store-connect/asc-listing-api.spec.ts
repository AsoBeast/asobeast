import { AscListingApi } from './asc-listing-api';
import { AscError } from './asc-errors';
import type { AscResponse } from './asc-transport';
import { failure, ok, recordedRequester } from './asc-transport.fixture';

const versions = (states: string[]): AscResponse =>
  ok({
    data: states.map((state, index) => ({
      id: String(900 - index),
      type: 'appStoreVersions',
      attributes: { appStoreState: state, version: `2.${index}` },
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
  it('reads the live version for the app', async () => {
    const { api, requests } = recorded(versions(['READY_FOR_SALE']));

    await expect(api.liveVersion('1476097583')).resolves.toEqual({
      id: '900',
      version: '2.0',
    });
    expect(requests[0]).toMatchObject({
      method: 'GET',
      path: '/v1/apps/1476097583/appStoreVersions?filter[appStoreState]=READY_FOR_SALE&fields[appStoreVersions]=version&limit=200',
    });
  });

  it('takes the newest live version when Apple answers several', async () => {
    const { api } = recorded(versions(['READY_FOR_SALE', 'READY_FOR_SALE']));

    await expect(api.liveVersion('1476097583')).resolves.toEqual({
      id: '900',
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
