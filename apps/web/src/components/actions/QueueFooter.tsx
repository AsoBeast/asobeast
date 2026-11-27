import { Fragment } from "react";
import { useTranslations } from "next-intl";
import { FOOTER_LINK } from "@/components/layout/panel-classes";
import { formatNumber } from "@/lib/format";

const ACTION_CENTER_GUIDE = "https://docs.asobeast.com/guides/action-center";

const KEY_HINTS = [
  { keys: ["j", "k"], does: "move" },
  { keys: ["Enter"], does: "opens" },
  { keys: ["d"], does: "marksDone" },
] as const;

const KEY =
  "rounded-sm border border-border px-1 font-sans text-tick font-medium text-muted-foreground";

function KeyHints() {
  const t = useTranslations("actions");
  return (
    <span className="hidden items-center gap-x-2 pointer-fine:flex">
      {KEY_HINTS.map((hint) => (
        <Fragment key={hint.does}>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            {hint.keys.map((key) => (
              <kbd key={key} className={KEY}>
                {key}
              </kbd>
            ))}
            <span>{t(`keyHints.${hint.does}`)}</span>
          </span>
        </Fragment>
      ))}
    </span>
  );
}

export function QueueFooter({
  loaded,
  total,
  onShowShortcuts,
}: {
  loaded: number;
  total: number;
  onShowShortcuts: () => void;
}) {
  const t = useTranslations("actions");
  return (
    <>
      {loaded === 0 ? (
        <span>{t("rulesOverHistory")}</span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            {total > loaded
              ? t("onlyLoaded", {
                  loaded: formatNumber(loaded),
                  total: formatNumber(total),
                })
              : t("loaded", {
                  loaded: formatNumber(loaded),
                  total: formatNumber(total),
                })}
          </span>
          <KeyHints />
        </span>
      )}
      <span className="flex items-center gap-4">
        <button type="button" className={FOOTER_LINK} onClick={onShowShortcuts}>
          <span>{t("shortcuts")}</span>
        </button>
        <a
          href={ACTION_CENTER_GUIDE}
          target="_blank"
          rel="noreferrer"
          className={FOOTER_LINK}
        >
          {t("guide")}
        </a>
      </span>
    </>
  );
}
