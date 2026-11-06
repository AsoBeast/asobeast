"use client";

import { useState } from "react";
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
import { storeLabel } from "@/lib/format";
import { seedKeywordInspection } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { cn } from "@/lib/utils";

export interface InspectFormValues {
  keyword: string;
  store: Store;
  country: string;
}

const failureMessage = (error: unknown): string =>
  error instanceof ApiError
    ? error.envelope.message
    : "Could not start the inspection";

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
  const [keyword, setKeyword] = useState(initial.keyword);
  const [store, setStore] = useState<Store>(initial.store);
  const [country, setCountry] = useState(initial.country);

  const inspect = useMutation({
    mutationFn: requestKeywordInspection,
    onSuccess: (inspection) => {
      seedKeywordInspection(queryClient, inspection);
      onInspected(inspection);
    },
    onError: (error) => toast.error(failureMessage(error)),
  });
  const submit = useSingleFlight(inspect);
  const ready = keyword.trim().length > 0 && isStorefront(store, country);

  return (
    <form
      aria-label="Inspect a keyword"
      className={cn("flex flex-wrap items-end gap-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (ready) submit({ keyword: keyword.trim(), store, country });
      }}
    >
      <div className="flex min-w-56 flex-1 flex-col gap-2">
        <Label htmlFor="inspect-keyword" className="xl:sr-only">
          Keyword
        </Label>
        <Input
          id="inspect-keyword"
          value={keyword}
          maxLength={STORE_SEARCH_QUERY_MAX_LENGTH}
          placeholder="e.g. habit tracker"
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="inspect-store" className="xl:sr-only">
          Store
        </Label>
        <Select value={store} onValueChange={(next) => setStore(next as Store)}>
          <SelectTrigger id="inspect-store" className="w-[180px]">
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="inspect-country" className="xl:sr-only">
          Country
        </Label>
        <CountrySelect
          id="inspect-country"
          store={store}
          value={country}
          ariaLabel="Country"
          onChange={setCountry}
        />
      </div>
      <Button type="submit" disabled={!ready || inspect.isPending}>
        {inspect.isPending ? "Starting…" : "Inspect"}
      </Button>
    </form>
  );
}
