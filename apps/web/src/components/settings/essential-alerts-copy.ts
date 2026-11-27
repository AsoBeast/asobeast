import type { EssentialAlertsNeed } from "@asobeast/shared";
import type { MessageTranslator } from "@/i18n/translator";

export interface EssentialNeedCopy {
  key: string;
  values: Record<string, string | number>;
}

export function essentialNeed(
  need: EssentialAlertsNeed | null | undefined,
): EssentialNeedCopy | null {
  if (need === "smtp") {
    return { key: "essential.needSmtp", values: {} };
  }
  if (need === "https") {
    return { key: "essential.needHttps", values: {} };
  }
  return null;
}

export function essentialNeedCopy(
  need: EssentialAlertsNeed | null | undefined,
  translator: MessageTranslator,
): string | null {
  const copy = essentialNeed(need);
  return copy
    ? translator(
        copy.key,
        need === "https" ? { variable: "WEB_PUBLIC_URL" } : copy.values,
      )
    : null;
}
