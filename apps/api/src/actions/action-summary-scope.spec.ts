import { BadRequestException } from '@nestjs/common';
import { parseSummaryScope } from './action-summary-scope';

describe('parseSummaryScope', () => {
  it('reads the app, store and country', () => {
    expect(
      parseSummaryScope({
        appId: 'app_1',
        store: 'GOOGLE_PLAY',
        country: 'de',
      }),
    ).toEqual({ appId: 'app_1', store: 'GOOGLE_PLAY', country: 'de' });
    expect(parseSummaryScope({})).toEqual({});
  });

  it('ignores every other parameter', () => {
    expect(parseSummaryScope({ appId: 'app_1', anything: '1' })).toEqual({
      appId: 'app_1',
    });
  });

  it('rejects a store outside the supported stores', () => {
    expect(() => parseSummaryScope({ store: 'NOPE' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects a country that is not a two letter code', () => {
    expect(() => parseSummaryScope({ country: 'USA' })).toThrow(
      BadRequestException,
    );
    expect(() => parseSummaryScope({ appId: ['a', 'b'] })).toThrow(
      BadRequestException,
    );
  });
});
