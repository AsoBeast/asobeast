import { ExternalLink } from "lucide-react";
import { appVersion, RELEASES_URL } from "@/components/layout/app-version";
import { MarkReleasesSeen } from "@/components/whats-new/MarkReleasesSeen";
import { ReleaseTimeline } from "@/components/whats-new/ReleaseTimeline";
import { ScrollToLinkedRelease } from "@/components/whats-new/ScrollToLinkedRelease";
import { releasesUpTo } from "@/lib/whats-new/release-notes";
import { RELEASES } from "@/lib/whats-new/releases";

export default function WhatsNewPage() {
  const releases = releasesUpTo(RELEASES, appVersion());

  return (
    <div className="page-reading flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-display tracking-tight text-balance">
          What&apos;s New
        </h1>
        <p className="text-body text-muted-foreground">
          What changed in AsoBeast, release by release, in plain words.
        </p>
        <a
          href={RELEASES_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-2 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <span>Technical release notes</span>
          <ExternalLink aria-hidden className="size-3.5 shrink-0" />
        </a>
      </div>
      <ReleaseTimeline releases={releases} />
      <MarkReleasesSeen version={releases[0]?.version ?? null} />
      <ScrollToLinkedRelease />
    </div>
  );
}
