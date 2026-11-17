import {
  isPasswordAllowed,
  isPasswordLengthAllowed,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@asobeast/shared";

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters.`;

export const PASSWORD_TOO_SHORT = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

export const PASSWORD_TOO_LONG = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;

export const PASSWORD_MOSTLY_SPACES = `Use at least ${PASSWORD_MIN_LENGTH} characters, not counting spaces.`;

export function passwordError(password: string): string | null {
  if (isPasswordAllowed(password)) return null;
  if (isPasswordLengthAllowed(password)) return PASSWORD_MOSTLY_SPACES;
  return [...password].length > PASSWORD_MAX_LENGTH
    ? PASSWORD_TOO_LONG
    : PASSWORD_TOO_SHORT;
}
