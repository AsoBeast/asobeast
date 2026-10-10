import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { EmailAlertsController } from './email-alerts.controller';

const marker = (key: string, handler: keyof EmailAlertsController): unknown =>
  Reflect.getMetadata(
    key,
    Object.getOwnPropertyDescriptor(EmailAlertsController.prototype, handler)
      ?.value as object,
  );

describe('EmailAlertsController', () => {
  it('lets an unsubscribe through without a session or an entitlement', () => {
    expect(marker(IS_PUBLIC_KEY, 'unsubscribe')).toBe(true);
    expect(marker(IS_PUBLIC_KEY, 'test')).toBeUndefined();
  });
});
