"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Store } from "@asobeast/shared";
import { StoreSearchField } from "@/components/apps/StoreSearchField";
import { useStoreSearch } from "@/components/apps/useStoreSearch";
import { Button } from "@/components/ui/button";
import { addCompetitor, ApiError } from "@/lib/api";
import { storeLabel } from "@/lib/format";
import { appDetailOptions, invalidateCompetitorMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";

const STORE_URL_EXAMPLES: Record<Store, string> = {
  APP_STORE: "Focus Timer or https://apps.apple.com/us/app/name/id123456789",
  GOOGLE_PLAY:
    "Focus Timer or https://play.google.com/store/apps/details?id=com.example.app",
};

export function AddCompetitorForm({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const search = useStoreSearch(detail.store, detail.country, url);

  const mutation = useMutation({
    mutationFn: (value: string) => addCompetitor(id, value),
    onSuccess: (competitor) => {
      invalidateCompetitorMutation(queryClient, id);
      setUrl("");
      toast.success(`Added ${competitor.name ?? "competitor"}`);
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
      setError("Could not reach the api to add this competitor");
    },
  });
  const addOnce = useSingleFlight(mutation);

  function add(value: string) {
    setError(null);
    setNote(null);
    addOnce(value);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const { input, enter } = search;
    if (input.kind === "url") add(url);
    if (input.kind === "invalid") {
      setNote(null);
      setError(input.message);
    }
    if (enter.kind === "pick") add(enter.result.storeAppId);
    if (enter.kind === "focus") search.firstResultRef.current?.focus();
  }

  return (
    <form onSubmit={submit}>
      <StoreSearchField
        id="competitor-search"
        label={`Competitor name or ${storeLabel(detail.store)} URL`}
        hint="Type a name to search, or paste a store URL. A new competitor gets positions on the next keyword check."
        placeholder={STORE_URL_EXAMPLES[detail.store]}
        store={detail.store}
        country={detail.country}
        value={url}
        onChange={setUrl}
        onPick={(result) => add(result.storeAppId)}
        search={search}
        error={error}
        note={note}
      >
        <Button
          type="submit"
          disabled={mutation.isPending || url.trim() === ""}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {mutation.isPending ? "Adding…" : "Add competitor"}
        </Button>
      </StoreSearchField>
    </form>
  );
}
