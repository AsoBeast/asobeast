"use client";

import { useState } from "react";
import type { ComponentProps, FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { Store, StoreSearchResult } from "@asobeast/shared";
import { StoreSearchField } from "@/components/apps/StoreSearchField";
import { useFieldOutcome } from "@/components/apps/useFieldOutcome";
import { useStoreSearch } from "@/components/apps/useStoreSearch";
import { Button } from "@/components/ui/button";
import { addCompetitor } from "@/lib/api";
import { storeLabel } from "@/lib/format";
import { appDetailOptions, invalidateCompetitorMutation } from "@/lib/queries";
import { busyRetry, noteWhileBusy } from "@/lib/query-retry";
import { useSingleFlight } from "@/lib/single-flight";

const STORE_URL_EXAMPLES: Record<Store, string> = {
  APP_STORE: "Focus Timer or https://apps.apple.com/us/app/name/id123456789",
  GOOGLE_PLAY:
    "Focus Timer or https://play.google.com/store/apps/details?id=com.example.app",
};

export function AddCompetitorForm({
  id,
  submitVariant = "default",
}: {
  id: string;
  submitVariant?: ComponentProps<typeof Button>["variant"];
}) {
  const t = useTranslations("competitors");
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const [url, setUrl] = useState("");
  const outcome = useFieldOutcome(t("add.failed"));
  const search = useStoreSearch(detail.store, detail.country, url);

  const mutation = useMutation({
    ...busyRetry,
    mutationFn: (value: string) => addCompetitor(id, value),
    onSuccess: (competitor) => {
      invalidateCompetitorMutation(queryClient, id);
      setUrl("");
      toast.success(t("add.added", { name: competitor.name ?? t("untitled") }));
    },
    onError: outcome.fail,
  });
  const addOnce = useSingleFlight(mutation);
  const inert = mutation.isPending || url.trim() === "";

  function changeUrl(next: string) {
    outcome.clear();
    setUrl(next);
  }

  function add(value: string) {
    outcome.clear();
    addOnce(value);
  }

  function pick(result: StoreSearchResult) {
    add(result.storeAppId);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inert) return;
    outcome.clear();
    const { input } = search;
    if (input.kind === "url") return add(url);
    if (input.kind === "invalid") return outcome.setError(input.message);
    const message = search.enterName(pick);
    if (message) outcome.setError(message);
  }

  return (
    <form onSubmit={submit}>
      <StoreSearchField
        id="competitor-search"
        label={t("add.label", { store: storeLabel(detail.store) })}
        hint={t("add.hint")}
        placeholder={STORE_URL_EXAMPLES[detail.store]}
        store={detail.store}
        country={detail.country}
        value={url}
        onChange={changeUrl}
        onPick={pick}
        search={search}
        error={outcome.error}
        note={noteWhileBusy(mutation, outcome.note)}
      >
        <Button
          type="submit"
          variant={submitVariant}
          aria-disabled={inert || undefined}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {mutation.isPending ? t("add.adding") : t("add.submit")}
        </Button>
      </StoreSearchField>
    </form>
  );
}
