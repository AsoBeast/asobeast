"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { MetadataDraft, MetadataField, Store } from "@asobeast/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ApiError, generateMetadataDrafts } from "@/lib/api";
import {
  LINT_SEVERITY_LABEL,
  LINT_SEVERITY_VARIANT,
  METADATA_FIELD_LABELS,
} from "@/lib/metadata-display";

const STORE_FIELDS: Record<Store, MetadataField[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription", "description"],
};

function DraftCard({ draft }: { draft: MetadataDraft }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.value);
      toast.success(`${METADATA_FIELD_LABELS[draft.field]} copied`);
    } catch {
      toast.error("Couldn't copy — select and copy it manually");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-foreground">
          {METADATA_FIELD_LABELS[draft.field]}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          {draft.chars}/{draft.limit}
        </span>
      </div>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-muted p-2 font-mono text-sm text-foreground">
        {draft.value}
      </pre>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          {draft.issues.length === 0 ? (
            <Badge variant="success">no issues</Badge>
          ) : (
            draft.issues.map((issue, index) => (
              <span
                key={`${issue.rule}-${index}`}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Badge variant={LINT_SEVERITY_VARIANT[issue.severity]}>
                  {LINT_SEVERITY_LABEL[issue.severity]} · {issue.rule}
                </Badge>
                {issue.message}
              </span>
            ))
          )}
        </div>
        <Button
          variant="outline"
          aria-label={`Copy ${METADATA_FIELD_LABELS[draft.field]} draft`}
          onClick={copy}
        >
          <Copy />
          Copy
        </Button>
      </div>
      {draft.rationale ? (
        <p className="mt-2 text-xs text-muted-foreground">{draft.rationale}</p>
      ) : null}
    </div>
  );
}

export function MetadataAssistantPanel({
  appId,
  store,
}: {
  appId: string;
  store: Store;
}) {
  const available = STORE_FIELDS[store];
  const [selected, setSelected] = useState<MetadataField[]>(available);
  const [instructions, setInstructions] = useState("");

  const mutation = useMutation({
    mutationKey: ["metadata-assistant", appId],
    mutationFn: () =>
      generateMetadataDrafts(appId, {
        fields: selected,
        instructions: instructions.trim() || undefined,
      }),
    onError: (error) => {
      toast.error(
        error instanceof ApiError
          ? error.envelope.message
          : "Draft generation failed",
      );
    },
  });

  const drafts = mutation.data?.drafts ?? [];

  function toggle(field: MetadataField, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, field] : current.filter((item) => item !== field),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">AI drafts</h2>
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="assistant-instructions"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Instructions (optional)
            </label>
            <textarea
              id="assistant-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Steer tone or angle — e.g. emphasise sleep tracking."
              className="w-full resize-y rounded-lg border border-border bg-muted p-2 text-sm text-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {available.map((field) => (
              <label
                key={field}
                className="flex items-center gap-2 text-sm text-foreground"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(field)}
                  onChange={(event) => toggle(field, event.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                {METADATA_FIELD_LABELS[field]}
              </label>
            ))}
          </div>
          <div>
            <Button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || selected.length === 0}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {drafts.length > 0 ? "Regenerate" : "Generate drafts"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {drafts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {drafts.map((draft) => (
            <DraftCard key={draft.field} draft={draft} />
          ))}
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Drafts are suggestions — asobeast never writes to the store.
      </p>
    </section>
  );
}
