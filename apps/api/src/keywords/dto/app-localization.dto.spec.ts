import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AddAppLocalizationDto } from './app-localization.dto';

const errorsOf = (body: Record<string, unknown>) =>
  validate(plainToInstance(AddAppLocalizationDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

describe('AddAppLocalizationDto', () => {
  it.each(['en-US', 'es-MX', 'zh-Hans'])(
    'accepts an App Store localization (%s)',
    async (localization) => {
      await expect(errorsOf({ localization })).resolves.toEqual([]);
    },
  );

  it.each(['xx', 'en-us', '', 5, undefined])(
    'refuses a tag outside the 50 or a value that is no string (%j)',
    async (localization) => {
      const errors = await errorsOf({ localization });

      expect(errors.map((error) => error.property)).toEqual(['localization']);
    },
  );

  it('refuses a property it does not know', async () => {
    const errors = await errorsOf({
      localization: 'es-MX',
      origin: 'detected',
    });

    expect(errors.map((error) => error.property)).toEqual(['origin']);
  });
});
