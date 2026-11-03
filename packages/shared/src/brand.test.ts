import { describe, expect, it } from 'vitest';
import { EMAIL_MARK_PATH, PRODUCT_NAME, SUPPORT_EMAIL } from './brand';

describe('brand', () => {
  it('names the product AsoBeast', () => {
    expect(PRODUCT_NAME).toBe('AsoBeast');
  });

  it('answers support at the asobeast.com mailbox', () => {
    expect(SUPPORT_EMAIL).toBe('hello@asobeast.com');
  });

  it('serves the email mark from the public brand folder', () => {
    expect(EMAIL_MARK_PATH).toBe('/brand/email-mark.png');
  });
});
