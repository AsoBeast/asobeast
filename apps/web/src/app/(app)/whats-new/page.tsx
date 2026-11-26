import { ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { appVersion, RELEASES_URL } from "@/components/layout/app-version";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReleaseTimeline } from "@/components/whats-new/ReleaseTimeline";
import { releasesUpTo } from "@/lib/whats-new/release-notes";
import { localizedRelease } from "@/lib/whats-new/localized-release";
import { RELEASES } from "@/lib/whats-new/releases";
import { DEFAULT_LOCALE, isLocale } from "@/lib/locale";

export default async function WhatsNewPage() {
  const currentLocale = await getLocale();
  const locale = isLocale(currentLocale) ? currentLocale : DEFAULT_LOCALE;
  const t = await getTranslations("releaseNotes");
  const releases = releasesUpTo(RELEASES, appVersion()).map((release) =>
    localizedRelease(release, locale),
  );

  return (
    <div className="page-reading flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        controls={
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-dense text-foreground link-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span>{t("technicalNotes")}</span>
            <ExternalLink aria-hidden className="size-3.5 shrink-0" />
          </a>
        }
      />
      <ReleaseTimeline releases={releases} />
    </div>
  );
}
