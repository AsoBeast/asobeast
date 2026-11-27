import { useId } from "react";
import { createTranslator } from "next-intl";
import type { KeywordTopApp, TrackedKeywordItem } from "@asobeast/shared";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { AppIcon } from "@/components/AppIcon";
import { cn } from "@/lib/utils";
import { ROW_PEEK } from "./row-peek";
import { rememberSerpOpener } from "./serp/serp-opener";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

const ICON_SIZE = 24;

const appLine = (app: KeywordTopApp, t: MessageTranslator): string =>
  t("topApps.line", {
    position: app.position,
    title: app.title,
    role: app.role === "other" ? "" : t(`topApps.roles.${app.role}`),
  });

export function TopAppsCell({
  keyword,
  onOpen,
  t = english,
}: {
  keyword: Pick<TrackedKeywordItem, "keywordId" | "text" | "topApps">;
  onOpen: () => void;
  t?: MessageTranslator;
}) {
  const appsId = useId();
  const apps = keyword.topApps;
  if (!apps || apps.length === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">{t("topApps.noResults")}</span>
      </span>
    );
  }
  const own = apps.find((app) => app.role === "own");
  return (
    <button
      type="button"
      aria-label={t("topApps.open", { keyword: keyword.text })}
      aria-describedby={appsId}
      data-serp-keyword={keyword.keywordId}
      onClick={(event) => {
        rememberSerpOpener(event.currentTarget);
        onOpen();
      }}
      className={cn("group/apps flex items-center", ROW_PEEK)}
    >
      <span id={appsId} className="sr-only">
        {t("topApps.summary", {
          apps: apps.map((app) => appLine(app, t)).join(", "),
        })}
      </span>
      {apps.map((app) => (
        <span
          key={app.position}
          title={appLine(app, t)}
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
        >
          {t("topApps.ownRank", { position: own.position })}
        </span>
      ) : null}
    </button>
  );
}
