"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  isStorefront,
  STORE_SEARCH_QUERY_MAX_LENGTH,
  STORES,
  type KeywordInspection,
  type Store,
} from "@asobeast/shared";
import { toast } from "sonner";
import { CountrySelect } from "@/components/CountrySelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError, requestKeywordInspection } from "@/lib/api";
import type { MessageTranslator } from "@/i18n/translator";
import { storeLabel } from "@/lib/format";
import { seedKeywordInspection } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";

export interface InspectFormValues {
  keyword: string;
  store: Store;
  country: string;
}

const failureMessage = (error: unknown, t: MessageTranslator): string =>
  error instanceof ApiError
    ? error.envelope.message
    : t("inspector.form.failed");

export function InspectForm({
  initial,
  onInspected,
  className,
}: {
  initial: InspectFormValues;
  onInspected: (inspection: KeywordInspection) => void;
  className?: string;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("keywordInspector");
  const [keyword, setKeyword] = useState(initial.keyword);
  const [store, setStore] = useState<Store>(initial.store);
  const [country, setCountry] = useState(initial.country);
  const incoming = `${initial.keyword}|${initial.store}|${initial.country}`;
  const [seen, setSeen] = useState(incoming);
  if (seen !== incoming) {
    setSeen(incoming);
    setKeyword(initial.keyword);
    setStore(initial.store);
    setCountry(initial.country);
  }

  const inspect = useMutation({
    mutationFn: requestKeywordInspection,
    onSuccess: (inspection) => {
      seedKeywordInspection(queryClient, inspection);
      onInspected(inspection);
    },
    onError: (error) => toast.error(failureMessage(error, t)),
  });
  const submit = useSingleFlight(inspect);
  const ready = keyword.trim().length > 0 && isStorefront(store, country);

  return (
    <form
      aria-label={t("inspector.form.aria")}
      className={cn("flex flex-wrap items-end gap-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit({ keyword: keyword.trim(), store, country });
      }}
    >
      <div className="flex w-full min-w-56 flex-col gap-2 sm:w-auto sm:flex-1">
        <Label htmlFor="inspect-keyword" className="xl:sr-only">
          {t("inspector.form.keyword")}
        </Label>
        <Input
          id="inspect-keyword"
          value={keyword}
          maxLength={STORE_SEARCH_QUERY_MAX_LENGTH}
          placeholder={t("inspector.form.keywordPlaceholder")}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto">
        <Label htmlFor="inspect-store" className="xl:sr-only">
          {t("inspector.form.store")}
        </Label>
        <Select
          value={store}
          onValueChange={(next) =>
            setStore(STORES.find((option) => option === next) ?? store)
          }
        >
          <SelectTrigger id="inspect-store" className="w-full sm:w-[180px]">
            <SelectValue>{storeLabel(store)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STORES.map((option) => (
              <SelectItem key={option} value={option}>
                {storeLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto max-sm:[&_[data-slot=select-trigger]]:w-full">
        <Label htmlFor="inspect-country" className="xl:sr-only">
          {t("inspector.form.country")}
        </Label>
        <CountrySelect
          id="inspect-country"
          store={store}
          value={country}
          ariaLabel={t("inspector.form.country")}
          onChange={setCountry}
        />
      </div>
      <Button
        type="submit"
        className="w-full sm:w-auto"
        disabled={!ready}
        aria-disabled={inspect.isPending || undefined}
      >
        {inspect.isPending
          ? t("inspector.form.starting")
          : t("inspector.form.inspect")}
      </Button>
    </form>
  );
}
