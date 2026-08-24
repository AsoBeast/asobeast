import { describe, expect, it } from 'vitest';
import { API_TOKEN_PREFIX, SESSION_COOKIE } from './auth';

describe('auth constants', () => {
  it('preserves the session cookie wire name', () => {
    expect(SESSION_COOKIE).toBe('asobeast_session');
  });

  it('preserves the personal api token prefix', () => {
    expect(API_TOKEN_PREFIX).toBe('asob_');
  });
});
