import {
  isPasswordAllowed,
  isPasswordLengthAllowed,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "@asobeast/shared";

import type { MessageTranslator } from "@/i18n/translator";

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters.`;

export const PASSWORD_TOO_SHORT = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

export const PASSWORD_TOO_LONG = `Use ${PASSWORD_MAX_LENGTH} characters or fewer.`;

export const PASSWORD_MOSTLY_SPACES = `Use at least ${PASSWORD_MIN_LENGTH} characters, not counting spaces.`;

export function passwordHint(t: MessageTranslator): string {
  return t("password.hint", { min: PASSWORD_MIN_LENGTH });
}

export function passwordError(
  password: string,
  t: MessageTranslator,
): string | null {
  if (isPasswordAllowed(password)) return null;
  if (isPasswordLengthAllowed(password)) {
    return t("password.mostlySpaces", { min: PASSWORD_MIN_LENGTH });
  }
  return [...password].length > PASSWORD_MAX_LENGTH
    ? t("password.tooLong", { max: PASSWORD_MAX_LENGTH })
    : t("password.tooShort", { min: PASSWORD_MIN_LENGTH });
}
