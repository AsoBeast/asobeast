import { PASSWORD_RULE } from '@asobeast/shared';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsPassword } from './password.decorator';

class PasswordFixture {
  @IsPassword()
  password!: string;
}

async function messagesFor(password: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(PasswordFixture, { password }));
  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('IsPassword', () => {
  it.each([
    ['the suite password', 'supersecret1'],
    ['a passphrase with internal spaces', 'correct horse'],
    ['a long enough password padded with spaces', ' supersecret1 '],
    ['the longest allowed password', 'a'.repeat(128)],
    ['ten emoji', '\u{1F600}'.repeat(10)],
  ])('accepts %s', async (_case, password) => {
    await expect(messagesFor(password)).resolves.toEqual([]);
  });

  it.each([
    ['ten spaces', ' '.repeat(10)],
    ['ten spaces and a tab', `${' '.repeat(10)}\t`],
    ['ten non breaking spaces', '\u00a0'.repeat(10)],
    ['mixed unicode whitespace', ' \t\n\r\u00a0\u2003\u3000\ufeff\u2028\u202f'],
    ['nine characters around one space', 'abcd efghi'],
    ['five emoji padded with spaces', `${'\u{1F600}'.repeat(5)}     `],
    ['two characters spread across whitespace', 'a         b'],
  ])('refuses %s with the password rule', async (_case, password) => {
    await expect(messagesFor(password)).resolves.toEqual([PASSWORD_RULE]);
  });

  it('refuses a nine character password with only the length message', async () => {
    await expect(messagesFor('123456789')).resolves.toEqual([
      'password must be longer than or equal to 10 characters',
    ]);
  });

  it('refuses a one character password with only the length message', async () => {
    await expect(messagesFor(' ')).resolves.toEqual([
      'password must be longer than or equal to 10 characters',
    ]);
  });

  it('refuses a password past the maximum with only the length message', async () => {
    await expect(messagesFor('a'.repeat(129))).resolves.toEqual([
      'password must be shorter than or equal to 128 characters',
    ]);
  });

  it('refuses an empty password', async () => {
    await expect(messagesFor('')).resolves.toEqual([
      'password must be longer than or equal to 10 characters',
    ]);
  });

  it('refuses a value that is not a string', async () => {
    const messages = await messagesFor(1234567890);

    expect(messages).toContain('password must be a string');
    expect(messages).not.toContain(PASSWORD_RULE);
  });

  it('leaves the validated value exactly as it was sent', async () => {
    const sent = '\u00a0 correct horse \t';
    const fixture = plainToInstance(PasswordFixture, { password: sent });

    await expect(validate(fixture)).resolves.toEqual([]);
    expect(Buffer.from(fixture.password)).toEqual(Buffer.from(sent));
  });
});
