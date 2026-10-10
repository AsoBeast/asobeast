import { app, suggest } from '@mradex77/google-play-scraper';
import { egressFetch } from './egress/egress';
import { googlePlayLib } from './google-play.lib';

jest.mock('@mradex77/google-play-scraper', () => ({
  ...jest.requireActual<object>('@mradex77/google-play-scraper'),
  app: jest.fn(),
  suggest: jest.fn(),
}));

describe('googlePlayLib', () => {
  it('hands the deadline to the scraper next to the egress fetch', async () => {
    const signal = AbortSignal.timeout(20_000);

    await googlePlayLib.app({
      appId: 'com.cyberlink.youcammakeup',
      country: 'tw',
      lang: 'zh-TW',
      signal,
    });

    expect(app).toHaveBeenCalledWith({
      appId: 'com.cyberlink.youcammakeup',
      country: 'tw',
      lang: 'zh-TW',
      requestOptions: { fetchImpl: egressFetch, signal },
    });
  });

  it('keeps the scraper defaults outside an on demand request', async () => {
    await googlePlayLib.suggest({ term: 'habit', country: 'us', lang: 'en' });

    expect(jest.mocked(suggest).mock.calls[0]).toStrictEqual([
      {
        term: 'habit',
        country: 'us',
        lang: 'en',
        requestOptions: { fetchImpl: egressFetch, signal: undefined },
      },
    ]);
  });
});
