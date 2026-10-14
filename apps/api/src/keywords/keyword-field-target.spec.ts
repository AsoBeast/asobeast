import { BadRequestException } from '@nestjs/common';
import { Store } from '@prisma/client';
import { UnknownStorefrontError } from '@asobeast/shared';
import { keywordFieldTarget } from './keyword-field-target';

const US_APP = { store: Store.APP_STORE, country: 'us' };

describe('keywordFieldTarget', () => {
  it('reads the default localization of the home storefront without a query', () => {
    expect(keywordFieldTarget(US_APP, {})).toEqual({
      country: 'us',
      localization: 'en-US',
    });
  });

  it('reads the default localization of a named market', () => {
    expect(keywordFieldTarget(US_APP, { country: 'de' })).toEqual({
      country: 'de',
      localization: 'de',
    });
  });

  it('keeps a localization the storefront reads', () => {
    expect(keywordFieldTarget(US_APP, { localization: 'es-MX' })).toEqual({
      country: 'us',
      localization: 'es-MX',
    });
  });

  it('names what the storefront reads when it does not read the localization', () => {
    expect(() =>
      keywordFieldTarget(US_APP, { country: 'de', localization: 'es-MX' }),
    ).toThrow(
      new BadRequestException(
        'The DE storefront reads German, English (U.K.), not Spanish (Mexico)',
      ),
    );
  });

  it('refuses a code that is not an app store storefront', () => {
    expect(() => keywordFieldTarget(US_APP, { country: 'zz' })).toThrow(
      UnknownStorefrontError,
    );
  });
});
