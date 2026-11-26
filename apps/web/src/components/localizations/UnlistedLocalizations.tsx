"use client";

import type { AppLocalizationsResult } from "@asobeast/shared";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { unlistedReads } from "@/lib/app-localizations";
import { armFocusHandoff } from "@/lib/focus-handoff";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { apiErrorMessage } from "@/lib/api";
import { localizationFocusKey } from "./LocalizationItem";
import { SUB_HEADER, SUB_HEADER_COUNT } from "./panel-rows";
import { ReaderChips } from "./ReadRoleBadge";
import { useAddLocalization } from "./useAddLocalization";

const HEADING_ID = "unlisted-localizations-heading";

export function UnlistedLocalizations({
  id,
  result,
}: {
  id: string;
  result: AppLocalizationsResult;
}) {
  const t = useTranslations("localizations");
  const locale = useAppLocale();
  const { add, pending, error } = useAddLocalization(id);
  const managed = result.storeManaged;
  const reads = unlistedReads(result);
  if (reads.length === 0) return null;

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col">
      <h3 id={HEADING_ID} className={SUB_HEADER}>
        <span>{t("unlisted.title")}</span>
        <span className={SUB_HEADER_COUNT}>{reads.length}</span>
      </h3>
      <ul
        aria-label={t("unlisted.aria")}
        className="grid list-none grid-cols-1 gap-x-8 px-4 py-1 @3xl/metadata:grid-cols-2"
      >
        {reads.map(({ localization, readIn }) => {
          const name = localizationNameInLocale(localization, locale);
          return (
            <li
              key={localization}
              className="flex min-h-10 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle py-1"
            >
              <span className="text-dense font-medium">{name}</span>
              <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <ReaderChips readers={readIn} />
                {managed ? null : (
                  <Button
                    variant="outline"
                    size="xs"
                    aria-label={t("unlisted.addAria", { name })}
                    aria-disabled={pending || undefined}
                    onClick={() => {
                      if (pending) return;
                      armFocusHandoff(localizationFocusKey(localization));
                      add(localization);
                    }}
                  >
                    {t("unlisted.add")}
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="max-w-[90ch] px-4 pt-1 pb-3 text-caption text-faint-foreground">
        {managed ? t("unlisted.managed") : t("unlisted.manual")}
      </p>
      {error ? (
        <p role="alert" className="px-4 pb-3 text-dense text-destructive">
          {apiErrorMessage(error, t("add.failed"))}
        </p>
      ) : null}
    </section>
  );
}
