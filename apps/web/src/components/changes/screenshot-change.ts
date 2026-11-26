import type { ChangeEventItem } from "@asobeast/shared";
import { createTranslator } from "next-intl";
import enChanges from "../../../messages/en/changes.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatListInLocale } from "@/lib/format";
import type { Locale } from "@/lib/locale";

const english = createTranslator({
  locale: "en",
  namespace: "changes",
  messages: { changes: enChanges },
});

export function hasScreenshotDetail(event: ChangeEventItem): boolean {
  return (
    event.detail !== undefined &&
    event.detail !== null &&
    event.field.startsWith("screenshot")
  );
}

const positions = (list: number[], locale: Locale): string =>
  formatListInLocale(list.map(String), locale);

const screenshotWord = (list: number[], t: MessageTranslator): string =>
  t(list.length === 1 ? "screenshot.one" : "screenshot.many");

const quoted = (text: string): string => `“${text}”`;

const capitalised = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function screenshotChangeSummary(
  event: ChangeEventItem,
  t: MessageTranslator = english,
  locale: Locale = "en",
): string {
  const detail = event.detail;
  if (detail?.kind === "captions") {
    const from = detail.removed.map(quoted).join(", ");
    const to = detail.added.map(quoted).join(", ");
    if (from && to) return t("screenshot.captionChanged", { from, to });
    return from
      ? t("screenshot.captionRemoved", { from })
      : t("screenshot.captionAdded", { to });
  }
  if (detail?.kind !== "images") return "";

  const replaced = Math.min(detail.added.length, detail.removed.length);
  const groups: Array<[number[], "replaced" | "added" | "removed"]> = [
    [detail.added.slice(0, replaced), "replaced"],
    [detail.added.slice(replaced), "added"],
    [detail.removed.slice(replaced), "removed"],
  ];
  const parts = groups
    .filter(([list]) => list.length > 0)
    .map(
      ([list, verb]) =>
        `${screenshotWord(list, t)} ${positions(list, locale)} ${t(`screenshot.${verb}`)}`,
    );
  if (detail.reordered) parts.push(t("screenshot.reordered"));
  const summary = parts.join(", ");
  return locale === "en" ? capitalised(summary) : summary;
}
