import { useId } from "react";
import type { KeywordTopApp, TrackedKeywordItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { cn } from "@/lib/utils";
import { rememberSerpOpener } from "./serp/serp-opener";

const ICON_SIZE = 24;

const ROLE_WORDS: Record<KeywordTopApp["role"], string> = {
  own: " (your app)",
  competitor: " (competitor)",
  other: "",
};

const appLine = (app: KeywordTopApp): string =>
  `#${app.position} ${app.title}${ROLE_WORDS[app.role]}`;

export function TopAppsCell({
  keyword,
  onOpen,
}: {
  keyword: Pick<TrackedKeywordItem, "keywordId" | "text" | "topApps">;
  onOpen: () => void;
}) {
  const appsId = useId();
  const apps = keyword.topApps;
  if (!apps || apps.length === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">
          No search results from today or yesterday
        </span>
      </span>
    );
  }
  const own = apps.find((app) => app.role === "own");
  return (
    <button
      type="button"
      aria-label={`View search results for ${keyword.text}`}
      aria-describedby={appsId}
      data-serp-keyword={keyword.keywordId}
      onClick={(event) => {
        rememberSerpOpener(event.currentTarget);
        onOpen();
      }}
      className="group/apps -m-1 flex items-center rounded-md p-1 outline-none transition-colors duration-150 ease-out hover:bg-card hover:shadow-[inset_0_0_0_1px_var(--border)] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span id={appsId} className="sr-only">
        {`Top apps: ${apps.map(appLine).join(", ")}`}
      </span>
      {apps.map((app) => (
        <span
          key={app.position}
          title={appLine(app)}
          data-role={app.role}
          className={cn(
            "relative -ml-1.5 flex rounded-md ring-2 ring-card first:ml-0 group-hover/row:ring-muted group-hover/apps:ring-card group-data-[state=selected]/row:ring-accent",
            app.role === "own" &&
              "z-10 after:absolute after:inset-x-0.5 after:-bottom-1.5 after:h-0.5 after:rounded-full after:bg-foreground",
          )}
        >
          <AppIcon src={app.iconUrl} size={ICON_SIZE} />
        </span>
      ))}
      {own ? (
        <span
          aria-hidden
          data-slot="own-rank"
          className="numeric ml-1.5 text-tick font-medium text-foreground keywords-snug:hidden"
        >{`you #${own.position}`}</span>
      ) : null}
    </button>
  );
}
