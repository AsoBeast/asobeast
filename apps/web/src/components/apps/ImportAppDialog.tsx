"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FormEvent, RefObject } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { STORES, type Store, type StoreSearchResult } from "@asobeast/shared";
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
import { Tabs, TabsList, TabsOption } from "@/components/ui/tabs";
import { importApp } from "@/lib/api";
import { marketError } from "@/lib/countries";
import { returnFocusTo } from "@/lib/focus-handoff";
import { storeLabel } from "@/lib/format";
import {
  appKeys,
  invalidateWorkspaceChecklist,
  portfolioKey,
} from "@/lib/queries";
import { busyRetry, noteWhileBusy } from "@/lib/query-retry";
import { useSingleFlight } from "@/lib/single-flight";
import { classifyInput, isStoreAddress } from "./store-search";
import { StoreSearchField } from "./StoreSearchField";
import { useFieldOutcome } from "./useFieldOutcome";
import { useStoreSearch } from "./useStoreSearch";

const DEFAULT_STORE: Store = "APP_STORE";
const DEFAULT_COUNTRY = "us";

function StoreTabs({
  store,
  onChange,
}: {
  store: Store;
  onChange: (store: Store) => void;
}) {
  const t = useTranslations("apps");
  return (
    <Tabs value={store} onValueChange={(next) => onChange(next as Store)}>
      <TabsList aria-label={t("import.store")}>
        {STORES.map((option) => (
          <TabsOption key={option} value={option}>
            {storeLabel(option)}
          </TabsOption>
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
  const t = useTranslations("apps");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="import-country">{t("import.homeStorefront")}</Label>
      <p className="text-caption text-muted-foreground">
        {t("import.homeStorefrontHint")}
      </p>
      <CountrySelect
        id="import-country"
        store={store}
        value={country}
        onChange={onChange}
        ariaLabel={t("import.homeStorefront")}
      />
    </div>
  );
}

export function ImportAppDialog({
  children,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  returnFocus,
}: {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("apps");
  const validationT = useTranslations("validation");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = onOpenChangeProp ?? setUncontrolledOpen;
  const [value, setValue] = useState("");
  const [store, setStore] = useState<Store>(DEFAULT_STORE);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const outcome = useFieldOutcome(t("import.unreachable"));
  const search = useStoreSearch(store, country, value);

  const mutation = useMutation({
    ...busyRetry,
    mutationFn: ({ url, country }: { url: string; country: string }) =>
      importApp(url, country),
    onSuccess: (app) => {
      void queryClient.invalidateQueries({ queryKey: appKeys.all });
      void queryClient.invalidateQueries({ queryKey: portfolioKey });
      invalidateWorkspaceChecklist(queryClient);
      setOpen(false);
      toast.success(
        t("import.success", { name: app.name ?? t("import.unknownApp") }),
      );
      router.push(`/apps/${app.id}/setup`);
    },
    onError: outcome.fail,
  });
  const importOnce = useSingleFlight(mutation);
  const inert = mutation.isPending || value.trim() === "";

  function reset() {
    setValue("");
    setStore(DEFAULT_STORE);
    setCountry(DEFAULT_COUNTRY);
    outcome.clear();
    mutation.reset();
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset();
    }
  }

  function onValueChange(next: string) {
    outcome.clear();
    setValue(next);
    const input = classifyInput(next, t);
    if (input.kind === "url" && isStoreAddress(next)) {
      setStore(input.parsed.store);
      setCountry(input.parsed.country);
    }
  }

  function onStoreChange(next: Store) {
    outcome.clear();
    setStore(next);
  }

  function onCountryChange(next: string) {
    outcome.clear();
    setCountry(next);
  }

  function importFrom(target: Store, url: string) {
    const invalidCountry = marketError(target, country, validationT);
    if (invalidCountry) {
      outcome.setError(invalidCountry);
      return;
    }
    importOnce({ url, country });
  }

  function pick(result: StoreSearchResult) {
    outcome.clear();
    importFrom(store, result.storeAppId);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inert) return;
    outcome.clear();
    const { input } = search;
    if (input.kind === "url") return importFrom(input.parsed.store, value);
    if (input.kind === "invalid") return outcome.setError(input.message);
    const message = search.enterName(pick);
    if (message) outcome.setError(message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
      <DialogContent onCloseAutoFocus={returnFocusTo(returnFocus)}>
        <DialogHeader>
          <DialogTitle>{t("import.title")}</DialogTitle>
          <DialogDescription>{t("import.description")}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
          <DialogBody>
            <StoreTabs store={store} onChange={onStoreChange} />

            <StoreSearchField
              id="import-url"
              label={t("import.nameOrUrl")}
              hint={t("import.hint")}
              placeholder={t(
                store === "APP_STORE"
                  ? "import.placeholderAppStore"
                  : "import.placeholderGooglePlay",
              )}
              store={store}
              country={country}
              value={value}
              onChange={onValueChange}
              onPick={pick}
              search={search}
              error={outcome.error}
              note={noteWhileBusy(mutation, outcome.note)}
              autoFocus
            />

            <StorefrontField
              store={store}
              country={country}
              onChange={onCountryChange}
            />
          </DialogBody>

          <DialogFooter>
            <Button type="submit" aria-disabled={inert || undefined}>
              {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
              {mutation.isPending ? t("import.pending") : t("import.action")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
