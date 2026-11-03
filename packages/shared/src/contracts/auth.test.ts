import { describe, expect, expectTypeOf, it } from 'vitest';
import { ENTRY_STEPS, type AuthUser, type EntryStep } from './auth';

describe('entry steps', () => {
  it('names the two steps an account can owe', () => {
    expect(ENTRY_STEPS).toEqual(['confirm-email', 'choose-plan']);
  });

  it('keeps the entry step optional on the account', () => {
    expectTypeOf<AuthUser['entryStep']>().toEqualTypeOf<
      EntryStep | undefined
    >();
  });
});
