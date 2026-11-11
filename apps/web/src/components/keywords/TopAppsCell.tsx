import type { KeywordTopApp } from "@asobeast/shared";
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

export function TopAppsCell({
  apps,
}: {
  apps: readonly KeywordTopApp[] | null | undefined;
}) {
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
  return (
    <span
      role="group"
      aria-label={`Top apps: ${apps.map(appLine).join(", ")}`}
      className="flex items-center"
    >
      {apps.map((app) => (
        <span
          key={app.position}
          title={appLine(app)}
          data-role={app.role}
          className={cn(
            "-ml-1.5 flex rounded-md ring-2 ring-card first:ml-0 group-hover/row:ring-muted group-data-[state=selected]/row:ring-accent",
            app.role === "own" &&
              "z-10 ring-foreground group-hover/row:ring-foreground group-data-[state=selected]/row:ring-foreground",
          )}
        >
          <AppIcon src={app.iconUrl} size={ICON_SIZE} />
        </span>
      ))}
    </span>
  );
}
