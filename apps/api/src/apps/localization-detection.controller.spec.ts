import { SPENDS_STORE_CAPACITY_KEY } from '../auth/decorators/spends-store-capacity.decorator';
import { RATE_CLASS_KEY } from '../auth/rate-limit/rate-class';
import { READ_ONLY_KEY } from '../auth/read-access';
import { LocalizationDetectionController } from './localization-detection.controller';

const marker = (key: string): unknown =>
  Reflect.getMetadata(
    key,
    Object.getOwnPropertyDescriptor(
      LocalizationDetectionController.prototype,
      'detect',
    )?.value as object,
  );

describe('LocalizationDetectionController markers', () => {
  it('spends store capacity', () => {
    expect(marker(SPENDS_STORE_CAPACITY_KEY)).toBe(true);
  });

  it('is a write that a read only token cannot call', () => {
    expect(marker(READ_ONLY_KEY)).toBeUndefined();
    expect(marker(RATE_CLASS_KEY)).toBeUndefined();
  });
});
