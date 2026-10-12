import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { RATE_CLASS_KEY } from '../auth/rate-limit/rate-class';
import { READ_ONLY_KEY } from '../auth/read-access';
import { LocalizationsController } from './localizations.controller';

const marker = (key: string, handler: keyof LocalizationsController): unknown =>
  Reflect.getMetadata(
    key,
    Object.getOwnPropertyDescriptor(LocalizationsController.prototype, handler)
      ?.value as object,
  );

describe('LocalizationsController keyword field markers', () => {
  it('prices the preview as a read and lets a read only token call it', () => {
    expect(marker(RATE_CLASS_KEY, 'previewKeywordField')).toBe('read');
    expect(marker(READ_ONLY_KEY, 'previewKeywordField')).toBe(true);
  });

  it('answers the preview with 200', () => {
    expect(marker(HTTP_CODE_METADATA, 'previewKeywordField')).toBe(200);
  });

  it('leaves the save a write', () => {
    expect(marker(RATE_CLASS_KEY, 'saveKeywordField')).toBeUndefined();
    expect(marker(READ_ONLY_KEY, 'saveKeywordField')).toBeUndefined();
  });
});
