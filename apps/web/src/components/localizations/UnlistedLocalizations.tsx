"use client";

import type { AppLocalizationsResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { unlistedReads } from "@/lib/app-localizations";
import { armFocusHandoff } from "@/lib/focus-handoff";
import { localizationName } from "@/lib/localizations";
import { apiErrorMessage } from "./api-error-message";
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
  const { add, pending, error } = useAddLocalization(id);
  const managed = result.storeManaged;
  const reads = unlistedReads(result);
  if (reads.length === 0) return null;

  return (
    <section aria-labelledby={HEADING_ID} className="flex flex-col">
      <h3 id={HEADING_ID} className={SUB_HEADER}>
        <span>Not listed yet</span>
        <span className={SUB_HEADER_COUNT}>{reads.length}</span>
      </h3>
      <ul
        aria-label="Localizations your markets read that are not listed"
        className="grid list-none grid-cols-1 gap-x-8 px-4 py-1 @3xl/metadata:grid-cols-2"
      >
        {reads.map(({ localization, readIn }) => {
          const name = localizationName(localization);
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
                    aria-label={`Add ${name}`}
                    aria-disabled={pending || undefined}
                    onClick={() => {
                      if (pending) return;
                      armFocusHandoff(localizationFocusKey(localization));
                      add(localization);
                    }}
                  >
                    Add
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="max-w-[90ch] px-4 pt-1 pb-3 text-caption text-faint-foreground">
        {managed
          ? "Your markets read these localizations. Add one your app ships in App Store Connect and the import brings its keyword field; a localization the store serves is added on its own after the next capture of that market."
          : "Your markets read these localizations. Add one your app ships in App Store Connect to type its keyword field; a localization the store serves is added on its own after the next capture of that market."}
      </p>
      {error ? (
        <p role="alert" className="px-4 pb-3 text-dense text-destructive">
          {apiErrorMessage(error, "Could not add the localization")}
        </p>
      ) : null}
    </section>
  );
}
