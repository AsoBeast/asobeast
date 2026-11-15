import { ExternalLink } from "lucide-react";
import { appVersion, RELEASES_URL } from "@/components/layout/app-version";
import { PageHeader } from "@/components/layout/PageHeader";
import { ReleaseTimeline } from "@/components/whats-new/ReleaseTimeline";
import { releasesUpTo } from "@/lib/whats-new/release-notes";
import { RELEASES } from "@/lib/whats-new/releases";

export default function WhatsNewPage() {
  const releases = releasesUpTo(RELEASES, appVersion());

  return (
    <div className="page-reading flex flex-col gap-6">
      <PageHeader
        title="What's New"
        controls={
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-8 items-center gap-1.5 rounded-sm text-dense text-foreground link-underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span>Technical release notes</span>
            <ExternalLink aria-hidden className="size-3.5 shrink-0" />
          </a>
        }
      />
      <ReleaseTimeline releases={releases} />
    </div>
  );
}
