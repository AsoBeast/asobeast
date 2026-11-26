import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { cn } from "@/lib/utils";
import type { Release } from "@/lib/whats-new/release-notes";
import { ReleaseChanges } from "./ReleaseChanges";
import { releaseAnchor } from "./release-view";

const TOGGLE =
  "inline-flex items-center gap-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring";

function VersionToggle({
  release,
  open,
  unread,
  onToggle,
  stretched,
  className,
}: {
  release: Release;
  open: boolean;
  unread: boolean;
  onToggle: () => void;
  stretched: boolean;
  className?: string;
}) {
  const t = useTranslations("releaseNotes");
  const anchor = releaseAnchor(release.version);
  const toggleKey = `${anchor}-toggle`;
  const claimFocus = useFocusClaim(toggleKey);
  return (
    <h2
      id={`${anchor}-version`}
      className={cn("text-heading tracking-tight", className)}
      translate="no"
    >
      <button
        ref={claimFocus}
        type="button"
        aria-expanded={open}
        aria-controls={open ? `${anchor}-body` : undefined}
        onClick={() => {
          armFocusHandoff(toggleKey);
          onToggle();
        }}
        className={cn(
          TOGGLE,
          stretched && "after:absolute after:inset-0 after:rounded-md",
        )}
      >
        <span className="sr-only">{t("version")}</span>
        <span className="numeric">{release.version}</span>
        {unread ? (
          <span
            aria-hidden
            className="size-1.5 shrink-0 rounded-full bg-brand-mark"
          />
        ) : null}
        {stretched ? null : (
          <ChevronRight
            aria-hidden
            className="size-4 rotate-90 text-muted-foreground"
          />
        )}
      </button>
    </h2>
  );
}

function UnreadNote({ unread }: { unread: boolean }) {
  const t = useTranslations("releaseNotes");
  return unread ? <span className="sr-only">{t("unread")}</span> : null;
}

function FoldedRelease({
  release,
  unread,
  onToggle,
}: {
  release: Release;
  unread: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("releaseNotes");
  const locale = useAppLocale();
  return (
    <div className="relative grid grid-cols-[auto_minmax(0,1fr)_1rem] items-center gap-x-3 gap-y-0.5 rounded-md py-2.5 pr-2 pl-2 transition-colors duration-150 ease-out hover:bg-muted sm:min-h-10 sm:grid-cols-[8rem_minmax(0,1fr)_auto_1rem] sm:gap-x-0 sm:py-0">
      <VersionToggle
        release={release}
        open={false}
        unread={unread}
        onToggle={onToggle}
        stretched
        className="col-start-1 row-start-1"
      />
      <UnreadNote unread={unread} />
      <span
        id={`${releaseAnchor(release.version)}-title`}
        className="col-span-2 col-start-1 row-start-2 text-dense wrap-anywhere sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:truncate"
      >
        {release.title}
      </span>
      <span className="col-start-2 row-start-1 text-caption text-faint-foreground sm:col-start-3 sm:px-3">
        <time dateTime={release.date}>
          {formatDateInLocale(release.date, locale)}
        </time>
        <span className="hidden sm:inline">
          {` · ${t("changeCount", { count: release.changes.length })}`}
        </span>
      </span>
      <ChevronRight
        aria-hidden
        className="col-start-3 row-span-2 row-start-1 size-4 text-muted-foreground sm:col-start-4 sm:row-span-1"
      />
    </div>
  );
}

function OpenRelease({
  release,
  latest,
  unread,
  onToggle,
}: {
  release: Release;
  latest: boolean;
  unread: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("releaseNotes");
  const locale = useAppLocale();
  return (
    <div className="grid gap-3 py-6 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-0">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 pl-2 sm:sticky sm:top-20 sm:flex-col sm:items-start sm:self-start">
        <VersionToggle
          release={release}
          open
          unread={unread}
          onToggle={onToggle}
          stretched={false}
        />
        <UnreadNote unread={unread} />
        <time
          dateTime={release.date}
          className="text-caption text-muted-foreground"
        >
          {formatDateInLocale(release.date, locale)}
        </time>
        {latest ? <Badge variant="brand">{t("latest")}</Badge> : null}
      </header>
      <div
        id={`${releaseAnchor(release.version)}-body`}
        className="flex min-w-0 flex-col gap-4"
      >
        <div className="flex flex-col gap-1.5">
          <p
            id={`${releaseAnchor(release.version)}-title`}
            className="text-heading font-semibold text-balance text-foreground"
          >
            {release.title}
          </p>
          <p className="max-w-[62ch] text-body text-foreground">
            {release.summary}
          </p>
        </div>
        <ReleaseChanges release={release} />
      </div>
    </div>
  );
}

export function ReleaseEntry({
  release,
  latest,
  open,
  unread,
  onToggle,
}: {
  release: Release;
  latest: boolean;
  open: boolean;
  unread: boolean;
  onToggle: () => void;
}) {
  const anchor = releaseAnchor(release.version);
  return (
    <li id={anchor} className="scroll-mt-20 border-b border-border">
      <article
        aria-labelledby={`${anchor}-version`}
        aria-describedby={`${anchor}-title`}
      >
        {open ? (
          <OpenRelease
            release={release}
            latest={latest}
            unread={unread}
            onToggle={onToggle}
          />
        ) : (
          <FoldedRelease
            release={release}
            unread={unread}
            onToggle={onToggle}
          />
        )}
      </article>
    </li>
  );
}
