export const SESSION_COOKIE = 'asobeast_session';

export const API_TOKEN_PREFIX = 'asob_';

export const UPGRADE_PATH = '/upgrade';

export const INVITE_PATH = '/invite';

export const VERIFY_PATH = '/verify';

export const FORGOT_PASSWORD_PATH = '/forgot-password';

export const RESET_PASSWORD_PATH = '/reset-password';

export const PASSWORD_MIN_LENGTH = 10;

export const PASSWORD_MAX_LENGTH = 128;

export const PASSWORD_RULE = `Password must contain at least ${PASSWORD_MIN_LENGTH} characters that are not whitespace.`;

const WHITESPACE = /\s/g;

function characterCount(text: string): number {
  return [...text].length;
}

export function isPasswordLengthAllowed(password: string): boolean {
  const length = characterCount(password);
  return length >= PASSWORD_MIN_LENGTH && length <= PASSWORD_MAX_LENGTH;
}

export function isPasswordAllowed(password: string): boolean {
  return (
    isPasswordLengthAllowed(password) &&
    characterCount(password.replace(WHITESPACE, '')) >= PASSWORD_MIN_LENGTH
  );
}
