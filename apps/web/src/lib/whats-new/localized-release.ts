import enCatalog from "../../../messages/en/releaseNotes.json";
import zhCatalog from "../../../messages/zh-CN/releaseNotes.json";
import type { Locale } from "@/lib/locale";
import type { Release } from "@/lib/whats-new/release-notes";

interface LocalizedRelease {
  title: string;
  summary: string;
  changes: readonly { title: string; text: string }[];
}

const catalogs: Record<Locale, Record<string, LocalizedRelease>> = {
  en: enCatalog as unknown as Record<string, LocalizedRelease>,
  "zh-CN": zhCatalog as unknown as Record<string, LocalizedRelease>,
};

export function localizedRelease(release: Release, locale: Locale): Release {
  const copy = catalogs[locale][release.version];
  if (!copy) return release;
  return {
    ...release,
    title: copy.title,
    summary: copy.summary,
    changes: release.changes.map((change, index) => ({
      ...change,
      title: copy.changes[index]?.title ?? change.title,
      text: copy.changes[index]?.text ?? change.text,
    })),
  };
}
