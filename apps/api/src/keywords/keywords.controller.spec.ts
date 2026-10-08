import { RATE_CLASS_KEY } from '../auth/rate-limit/rate-class';
import { READ_ONLY_KEY } from '../auth/read-access';
import { KeywordsController } from './keywords.controller';

const marker = (key: string, handler: keyof KeywordsController): unknown =>
  Reflect.getMetadata(
    key,
    Object.getOwnPropertyDescriptor(KeywordsController.prototype, handler)
      ?.value as object,
  );

describe('KeywordsController import markers', () => {
  it('prices the preview as a read and lets a read only token call it', () => {
    expect(marker(RATE_CLASS_KEY, 'previewImport')).toBe('read');
    expect(marker(READ_ONLY_KEY, 'previewImport')).toBe(true);
  });

  it('leaves the import a write', () => {
    expect(marker(RATE_CLASS_KEY, 'importKeywords')).toBeUndefined();
    expect(marker(READ_ONLY_KEY, 'importKeywords')).toBeUndefined();
  });
});
