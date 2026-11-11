import { useId } from "react";
import { ListOrdered } from "lucide-react";
import type { KeywordTopApp, TrackedKeywordItem } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { cn } from "@/lib/utils";

const ICON_SIZE = 24;

const ROLE_WORDS: Record<KeywordTopApp["role"], string> = {
  own: " (your app)",
  competitor: " (competitor)",
  other: "",
};

const appLine = (app: KeywordTopApp): string =>
  `#${app.position} ${app.title}${ROLE_WORDS[app.role]}`;

const NO_FRESH_RESULTS = "No search results from today or yesterday";

export function TopAppsCell({
  keyword,
  onOpen,
}: {
  keyword: Pick<TrackedKeywordItem, "keywordId" | "text" | "topApps">;
  onOpen: () => void;
}) {
  const factsId = useId();
  const apps = keyword.topApps ?? [];
  return (
    <button
      type="button"
      aria-label={`View search results for ${keyword.text}`}
      aria-describedby={factsId}
      data-serp-keyword={keyword.keywordId}
      onClick={onOpen}
      className="group/apps -m-1 flex min-h-8 cursor-pointer items-center rounded-md p-1 text-muted-foreground outline-none transition-colors duration-150 ease-out hover:bg-card hover:text-foreground hover:shadow-[inset_0_0_0_1px_var(--border)] focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span id={factsId} className="sr-only">
        {apps.length === 0
          ? NO_FRESH_RESULTS
          : `Top apps: ${apps.map(appLine).join(", ")}`}
      </span>
      {apps.length === 0 ? (
        <span title={NO_FRESH_RESULTS} className="flex px-1">
          <ListOrdered aria-hidden className="size-4" />
        </span>
      ) : null}
      {apps.map((app) => (
        <span
          key={app.position}
          title={appLine(app)}
          data-role={app.role}
          className={cn(
            "-ml-1.5 flex rounded-md ring-2 ring-card first:ml-0 group-hover/row:ring-muted group-hover/apps:ring-card group-data-[state=selected]/row:ring-accent",
            app.role === "own" &&
              "z-10 ring-foreground group-hover/apps:ring-foreground group-hover/row:ring-foreground group-data-[state=selected]/row:ring-foreground",
          )}
        >
          <AppIcon src={app.iconUrl} size={ICON_SIZE} />
        </span>
      ))}
    </button>
  );
}
