"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { Info, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { parseStoreUrl, type Store } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCompetitor, ApiError } from "@/lib/api";
import { storeLabel } from "@/lib/format";
import { appDetailOptions, invalidateCompetitorMutation } from "@/lib/queries";

const STORE_URL_EXAMPLES: Record<Store, string> = {
  APP_STORE: "https://apps.apple.com/us/app/name/id123456789",
  GOOGLE_PLAY: "https://play.google.com/store/apps/details?id=com.example.app",
};

export function AddCompetitorForm({ id }: { id: string }) {
  const queryClient = useQueryClient();
  const { data: detail } = useSuspenseQuery(appDetailOptions(id));
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNote(null);

    try {
      parseStoreUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unrecognized store URL");
      return;
    }

    mutation.mutate(url);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={STORE_URL_EXAMPLES[detail.store]}
          aria-invalid={error !== null}
          aria-label={`Competitor ${storeLabel(detail.store)} URL`}
        />
        <Button
          type="submit"
          disabled={mutation.isPending || url.trim() === ""}
        >
          {mutation.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          {mutation.isPending ? "Adding…" : "Add competitor"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        New competitors get positions on the next daily run.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {note ? (
        <Alert>
          <Info />
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ) : null}
    </form>
  );
}
