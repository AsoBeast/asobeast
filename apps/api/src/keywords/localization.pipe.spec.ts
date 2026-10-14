import { BadRequestException } from '@nestjs/common';
import { LocalizationPipe } from './localization.pipe';

describe('LocalizationPipe', () => {
  const pipe = new LocalizationPipe();

  it.each(['en-US', 'es-MX', 'zh-Hans'])('passes %s through', (tag) => {
    expect(pipe.transform(tag)).toBe(tag);
  });

  it.each(['xx', 'en-us', 'es', ''])(
    'refuses %j with the unknown localization message',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(
        new BadRequestException(`Unknown App Store localization: ${value}`),
      );
    },
  );

  it.each(['constructor', '__proto__', 'toString'])(
    'refuses the object key %s',
    (value) => {
      expect(() => pipe.transform(value)).toThrow(BadRequestException);
    },
  );
});
