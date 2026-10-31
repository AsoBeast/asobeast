"use client";

import type { AppLocalizationsResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { unlistedReads } from "@/lib/app-localizations";
import { localizationName } from "@/lib/localizations";
import { apiErrorMessage } from "./api-error-message";
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
    <section aria-labelledby={HEADING_ID} className="flex flex-col gap-2">
      <h3 id={HEADING_ID} className="font-medium">
        Not listed yet
      </h3>
      <p className="text-body text-muted-foreground">
        {managed
          ? "Your markets read these localizations. Add one your app ships in App Store Connect and the import brings its keyword field; a localization the store serves is added on its own after the next capture of that market."
          : "Your markets read these localizations. Add one your app ships in App Store Connect to type its keyword field; a localization the store serves is added on its own after the next capture of that market."}
      </p>
      <ul
        aria-label="Localizations your markets read that are not listed"
        className="flex flex-col divide-y divide-border rounded-lg border border-border px-3"
      >
        {reads.map(({ localization, readIn }) => {
          const name = localizationName(localization);
          return (
            <li
              key={localization}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2"
            >
              <span className="font-medium">{name}</span>
              <span className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <ReaderChips readers={readIn} />
                {managed ? null : (
                  <Button
                    variant="outline"
                    size="xs"
                    aria-label={`Add ${name}`}
                    disabled={pending}
                    onClick={() => add(localization)}
                  >
                    Add
                  </Button>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {apiErrorMessage(error, "Could not add the localization")}
        </p>
      ) : null}
    </section>
  );
}
