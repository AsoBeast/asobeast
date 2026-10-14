"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  parseStoreUrl,
  STORES,
  type Store,
  type StoreSearchResult,
} from "@asobeast/shared";
import { useRouter } from "next/navigation";
import { CountrySelect } from "@/components/CountrySelect";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, importApp } from "@/lib/api";
import { marketError } from "@/lib/countries";
import { storeLabel } from "@/lib/format";
import { appKeys, portfolioKey } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { StoreSearchField } from "./StoreSearchField";
import { useStoreSearch } from "./useStoreSearch";

const DEFAULT_STORE: Store = "APP_STORE";
const DEFAULT_COUNTRY = "us";

const PLACEHOLDERS: Record<Store, string> = {
  APP_STORE: "Focus Timer or apps.apple.com/us/app/…/id123",
  GOOGLE_PLAY: "Focus Timer or com.example.app",
};

function StoreTabs({
  store,
  onChange,
}: {
  store: Store;
  onChange: (store: Store) => void;
}) {
  return (
    <Tabs value={store} onValueChange={(next) => onChange(next as Store)}>
      <TabsList aria-label="Store">
        {STORES.map((option) => (
          <TabsTrigger key={option} value={option}>
            {storeLabel(option)}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

function StorefrontField({
  store,
  country,
  onChange,
}: {
  store: Store;
  country: string;
  onChange: (country: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="import-country">Home storefront</Label>
      <p className="text-xs text-muted-foreground">
        Where this app’s metadata and category ranks are read. Add other markets
        later from the keyword monitor.
      </p>
      <CountrySelect
        id="import-country"
        store={store}
        value={country}
        onChange={onChange}
        ariaLabel="Home storefront"
      />
    </div>
  );
}

export function ImportAppDialog({
  children,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChangeProp ?? setUncontrolledOpen;
  const [value, setValue] = useState("");
  const [store, setStore] = useState<Store>(DEFAULT_STORE);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const search = useStoreSearch(store, country, value);

  const mutation = useMutation({
    mutationFn: ({ url, country }: { url: string; country: string }) =>
      importApp(url, country),
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.all });
      void queryClient.invalidateQueries({ queryKey: portfolioKey });
      setOpen(false);
      toast.success(`Imported ${app.name ?? "app"}`);
      router.push(`/apps/${app.id}/setup`);
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.envelope.statusCode === 501) {
          setNote(err.envelope.message);
        } else {
          setError(err.envelope.message);
        }
        return;
      }
      setError("Could not reach the api to import this app");
    },
  });
  const importOnce = useSingleFlight(mutation);

  function reset() {
    setValue("");
    setStore(DEFAULT_STORE);
    setCountry(DEFAULT_COUNTRY);
    setError(null);
    setNote(null);
    mutation.reset();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
    }
  }

  function onValueChange(next: string) {
    setValue(next);
    try {
      const parsed = parseStoreUrl(next);
      setStore(parsed.store);
      setCountry(parsed.country);
    } catch {
      return;
    }
  }

  function importFrom(target: Store, url: string) {
    const invalidCountry = marketError(target, country);
    if (invalidCountry) {
      setError(invalidCountry);
      return;
    }
    importOnce({ url, country });
  }

  function pick(result: StoreSearchResult) {
    setError(null);
    setNote(null);
    importFrom(store, result.storeAppId);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNote(null);
    const { input, enter } = search;
    if (input.kind === "url") importFrom(input.parsed.store, value);
    if (input.kind === "invalid") setError(input.message);
    if (enter.kind === "pick") importFrom(store, enter.result.storeAppId);
    if (enter.kind === "focus") search.firstResultRef.current?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import an app</DialogTitle>
          <DialogDescription>
            Search the App Store or Google Play by name, or paste a store URL,
            to import the app and start tracking its keywords.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogBody>
            <StoreTabs store={store} onChange={setStore} />

            <StoreSearchField
              id="import-url"
              label="App name or store URL"
              hint="Type a name to search, or paste a store URL."
              placeholder={PLACEHOLDERS[store]}
              store={store}
              country={country}
              value={value}
              onChange={onValueChange}
              onPick={pick}
              search={search}
              error={error}
              note={note}
              autoFocus
            />

            <StorefrontField
              store={store}
              country={country}
              onChange={setCountry}
            />
          </DialogBody>

          <DialogFooter>
            <Button
              type="submit"
              disabled={mutation.isPending || value.trim() === ""}
            >
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {mutation.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
