"use client";

import { useId, type ReactNode, type Ref } from "react";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";
import type { Store, StoreSearchResult } from "@asobeast/shared";
import { AppIcon } from "@/components/AppIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatCountryInLocale,
  formatRatingInLocale,
  storeLabel,
} from "@/lib/format";
import type { MessageTranslator } from "@/i18n/translator";
import type { Locale } from "@/lib/locale";
import { useAppLocale } from "@/lib/use-app-locale";
import { searchErrorText, searchRetryable } from "./store-search";
import type { StoreSearch } from "./useStoreSearch";

const SKELETON_ROWS = 4;
const ICON_SIZE = 32;

function ratingText(
  result: StoreSearchResult,
  t: MessageTranslator,
  locale: Locale,
): string | null {
  if (result.ratingAvg === null) return null;
  if (result.ratingCount === null) {
    return formatRatingInLocale(result.ratingAvg, locale);
  }
  return t("import.ratingCount", {
    average: formatRatingInLocale(result.ratingAvg, locale),
    count: result.ratingCount,
  });
}

function ResultRow({
  result,
  onPick,
  buttonRef,
}: {
  result: StoreSearchResult;
  onPick: (result: StoreSearchResult) => void;
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const t = useTranslations("apps");
  const locale = useAppLocale();
  const rating = ratingText(result, t, locale);
  return (
    <li>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => onPick(result)}
        className="flex w-full min-w-0 items-center gap-3 rounded-md px-2 py-1.5 text-left outline-none transition-colors duration-150 hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <AppIcon src={result.iconUrl} size={ICON_SIZE} />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body font-medium">{result.title}</span>
          {result.developer ? (
            <span className="truncate text-caption text-muted-foreground">
              {result.developer}
            </span>
          ) : null}
        </span>
        {rating ? (
          <span className="numeric ml-auto shrink-0 text-caption text-muted-foreground">
            {rating}
          </span>
        ) : null}
      </button>
    </li>
  );
}

function StoreSearchResults({
  listId,
  store,
  country,
  search,
  onPick,
}: {
  listId: string;
  store: Store;
  country: string;
  search: StoreSearch;
  onPick: (result: StoreSearchResult) => void;
}) {
  const t = useTranslations("apps");
  const commonT = useTranslations("common");
  const locale = useAppLocale();
  if (search.error) {
    return (
      <div className="flex items-center justify-between gap-3">
        <p role="alert" className="text-body text-destructive">
          {searchErrorText(search.error, t)}
        </p>
        {searchRetryable(search.error) ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={search.retry}
          >
            {commonT("retry")}
          </Button>
        ) : null}
      </div>
    );
  }
  if (!search.results) {
    return search.pending ? (
      <div aria-hidden className="flex flex-col gap-2">
        {Array.from({ length: SKELETON_ROWS }, (_, index) => (
          <Skeleton key={index} className="h-10" />
        ))}
      </div>
    ) : null;
  }
  if (search.settled && search.results.length === 0) {
    return (
      <p role="status" className="text-body text-muted-foreground">
        {t("import.noListing", {
          query: search.q,
          country: formatCountryInLocale(country, locale),
        })}
      </p>
    );
  }
  return (
    <ul
      id={listId}
      role="list"
      aria-label={t("import.resultsLabel", {
        store: storeLabel(store),
        country: formatCountryInLocale(country, locale),
      })}
      aria-busy={search.pending}
      className="flex max-h-64 flex-col gap-1 overflow-y-auto"
    >
      {search.results.map((result, index) => (
        <ResultRow
          key={result.storeAppId}
          result={result}
          onPick={onPick}
          buttonRef={index === 0 ? search.firstResultRef : undefined}
        />
      ))}
    </ul>
  );
}

export function StoreSearchField({
  id,
  label,
  hint,
  placeholder,
  store,
  country,
  value,
  onChange,
  onPick,
  search,
  error,
  note,
  autoFocus,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  placeholder: string;
  store: Store;
  country: string;
  value: string;
  onChange: (value: string) => void;
  onPick: (result: StoreSearchResult) => void;
  search: StoreSearch;
  error: string | null;
  note: string | null;
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const listId = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const shownError = error ?? search.problem;
  const listed =
    !search.error && search.results !== undefined && search.results.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={id}
          type="text"
          inputMode="search"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-invalid={shownError !== null}
          aria-describedby={shownError ? `${errorId} ${hintId}` : hintId}
          aria-controls={listed ? listId : undefined}
        />
        {children}
      </div>
      <p id={hintId} className="text-caption text-muted-foreground">
        {hint}
      </p>
      {shownError ? (
        <p id={errorId} className="text-body text-destructive wrap-anywhere">
          {shownError}
        </p>
      ) : null}
      {note ? (
        <Alert>
          <Info />
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ) : null}
      {search.q === "" ? null : (
        <StoreSearchResults
          listId={listId}
          store={store}
          country={country}
          search={search}
          onPick={onPick}
        />
      )}
    </div>
  );
}
