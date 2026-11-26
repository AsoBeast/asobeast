import { IntlMessageFormat } from "intl-messageformat";
import type { Locale } from "@/lib/locale";

export type MessageValues = Record<string, string | number>;

const formatters = new Map<string, IntlMessageFormat>();

export function formatMessage(
  message: string,
  locale: Locale,
  values: MessageValues = {},
): string {
  const key = `${locale}:${message}`;
  const cached = formatters.get(key);
  const formatter = cached ?? new IntlMessageFormat(message, locale);
  if (!cached) formatters.set(key, formatter);
  return formatter
    .formatToParts(values)
    .map((part) => part.value)
    .join("");
}
