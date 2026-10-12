import {
  CONFIRMATION_DAYS,
  confirmationToken,
  isConfirmationExpired,
  isConfirmationToken,
} from './confirmation-token';
import { unsubscribeToken } from './unsubscribe-token';

const SECRET = 'a'.repeat(32);
const SENT_AT = new Date('2026-10-11T08:00:00.000Z');
const OPS = { alertId: 'ea_1', email: 'ops@example.com', sentAt: SENT_AT };

describe('confirmation token', () => {
  it('ignores the case of the address', () => {
    expect(
      confirmationToken(SECRET, { ...OPS, email: 'Ops@Example.com' }),
    ).toBe(confirmationToken(SECRET, OPS));
  });

  it('accepts only the token minted for that alert, address and send', () => {
    const token = confirmationToken(SECRET, OPS);
    expect(isConfirmationToken(SECRET, OPS, token)).toBe(true);
    expect(
      isConfirmationToken(SECRET, { ...OPS, alertId: 'ea_2' }, token),
    ).toBe(false);
    expect(
      isConfirmationToken(SECRET, { ...OPS, email: 'team@example.com' }, token),
    ).toBe(false);
    expect(
      isConfirmationToken(
        SECRET,
        { ...OPS, sentAt: new Date(SENT_AT.getTime() + 1) },
        token,
      ),
    ).toBe(false);
    expect(isConfirmationToken('b'.repeat(32), OPS, token)).toBe(false);
  });

  it('is never accepted as an unsubscribe token, nor the other way round', () => {
    const { alertId, email } = OPS;
    expect(confirmationToken(SECRET, OPS)).not.toBe(
      unsubscribeToken(SECRET, { alertId, email }),
    );
    expect(
      isConfirmationToken(
        SECRET,
        OPS,
        unsubscribeToken(SECRET, { alertId, email }),
      ),
    ).toBe(false);
  });
});

describe('confirmation expiry', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('keeps a link alive until its last moment', () => {
    const lastMoment = SENT_AT.getTime() + CONFIRMATION_DAYS * DAY_MS - 1;
    expect(isConfirmationExpired(SENT_AT, lastMoment)).toBe(false);
  });

  it('expires a link once its lifetime has passed', () => {
    const lifetime = SENT_AT.getTime() + CONFIRMATION_DAYS * DAY_MS;
    expect(isConfirmationExpired(SENT_AT, lifetime)).toBe(true);
  });
});
