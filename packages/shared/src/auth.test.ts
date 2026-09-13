import { describe, expect, it } from 'vitest';
import {
  API_TOKEN_PREFIX,
  isPasswordAllowed,
  isPasswordLengthAllowed,
  SESSION_COOKIE,
} from './auth';

describe('auth constants', () => {
  it('preserves the session cookie wire name', () => {
    expect(SESSION_COOKIE).toBe('asobeast_session');
  });

  it('preserves the personal api token prefix', () => {
    expect(API_TOKEN_PREFIX).toBe('asob_');
  });
});

describe('password rule', () => {
  it.each([
    'supersecret1',
    'correct horse',
    ' supersecret1 ',
    'a'.repeat(128),
    '\u{1F600}'.repeat(10),
  ])('allows %j', (password) => {
    expect(isPasswordAllowed(password)).toBe(true);
  });

  it.each([
    '',
    '123456789',
    ' '.repeat(10),
    '\u00a0'.repeat(10),
    'a         b',
    `${'\u{1F600}'.repeat(5)}     `,
    'a'.repeat(129),
  ])('refuses %j', (password) => {
    expect(isPasswordAllowed(password)).toBe(false);
  });

  it('measures length by code point', () => {
    expect(isPasswordLengthAllowed('\u{1F600}'.repeat(5))).toBe(false);
    expect(isPasswordLengthAllowed('\u{1F600}'.repeat(128))).toBe(true);
    expect(isPasswordLengthAllowed('\u{1F600}'.repeat(129))).toBe(false);
  });
});
