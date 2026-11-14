"use client";

import { Suspense, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
  APP_STORE_LOCALIZATIONS,
  type MetadataDraft,
  type MetadataField,
  type Store,
} from "@asobeast/shared";
import {
  AiCallsLeft,
  useAiAllowanceSpent,
  useAiFailureToast,
} from "@/components/ai/ai-allowance";
import { PANEL_HEADER } from "@/components/layout/panel-classes";
import { SUB_HEADER } from "@/components/localizations/panel-rows";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { generateMetadataDrafts } from "@/lib/api";
import { PRODUCT_NAME } from "@/lib/brand";
import { invalidateAiUsage } from "@/lib/queries";
import { METADATA_FIELD_LABELS } from "@/lib/metadata-display";
import { draftLocaleParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";
import { DraftLocalizationSelect } from "./DraftLocalizationSelect";
import { DraftLocalizationSkeleton } from "./skeletons";
import { LintIssueRow } from "./LintIssueRow";

const STORE_FIELDS: Record<Store, MetadataField[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription", "description"],
};

function DraftRow({ draft }: { draft: MetadataDraft }) {
  const label = METADATA_FIELD_LABELS[draft.field];

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy. Select and copy it manually.");
    }
  }

  return (
    <li className="flex min-w-0 flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="flex items-baseline gap-2 text-label">
          <span>{label}</span>
          <span className="numeric font-normal text-faint-foreground">
            {`${draft.chars}/${draft.limit}`}
          </span>
        </h3>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Copy ${label} draft`}
          onClick={copy}
        >
          <Copy aria-hidden />
          <span>Copy</span>
        </Button>
      </div>
      <p className="text-body whitespace-pre-wrap wrap-anywhere">
        {draft.value}
      </p>
      {draft.issues.length > 0 ? (
        <ul className="flex min-w-0 list-none flex-col gap-1 p-0">
          {draft.issues.map((issue, index) => (
            <LintIssueRow key={`${issue.rule}-${index}`} issue={issue} />
          ))}
        </ul>
      ) : null}
      {draft.rationale ? (
        <p className="max-w-[70ch] text-caption text-muted-foreground">
          {draft.rationale}
        </p>
      ) : null}
    </li>
  );
}

export function MetadataAssistantPanel({
  appId,
  store,
  canLocalize,
}: {
  appId: string;
  store: Store;
  canLocalize: boolean;
}) {
  const available = STORE_FIELDS[store];
  const [selected, setSelected] = useState<MetadataField[]>(available);
  const [instructions, setInstructions] = useState("");
  const [draftLocale] = useQueryState("draftLocale", draftLocaleParser);
  const queryClient = useQueryClient();
  const spent = useAiAllowanceSpent();
  const failAi = useAiFailureToast();
  const headingId = useId();
  const instructionsId = useId();

  const mutation = useMutation({
    mutationKey: ["metadata-assistant", appId],
    mutationFn: () =>
      generateMetadataDrafts(appId, {
        fields: selected,
        instructions: instructions.trim() || undefined,
        localization: canLocalize ? (draftLocale ?? undefined) : undefined,
      }),
    onError: (error) => failAi(error, "Draft generation failed"),
    onSettled: () => invalidateAiUsage(queryClient),
  });
  const draftOnce = useSingleFlight(mutation);

  const drafts = mutation.data?.drafts ?? [];
  const drafted = mutation.data?.localization ?? null;

  function toggle(field: MetadataField, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, field] : current.filter((item) => item !== field),
    );
  }

  return (
    <section aria-labelledby={headingId}>
      <Card>
        <CardHeader className={PANEL_HEADER}>
          <CardTitle asChild>
            <h2 id={headingId}>AI drafts</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canLocalize ? (
            <Suspense fallback={<DraftLocalizationSkeleton />}>
              <DraftLocalizationSelect appId={appId} />
            </Suspense>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor={instructionsId}>Instructions (optional)</Label>
            <Textarea
              id={instructionsId}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Steer tone or angle, for example: emphasise sleep tracking."
              className="max-w-[70ch] resize-y"
            />
          </div>
          <div className="flex flex-wrap gap-4">
            {available.map((field) => (
              <Label key={field} className="font-normal">
                <Checkbox
                  checked={selected.includes(field)}
                  onCheckedChange={(checked) => toggle(field, checked === true)}
                />
                <span>{METADATA_FIELD_LABELS[field]}</span>
              </Label>
            ))}
          </div>
          <div className="flex flex-col items-start gap-2">
            <Button
              onClick={() => draftOnce()}
              disabled={selected.length === 0 || spent}
              aria-disabled={mutation.isPending || undefined}
            >
              {mutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Sparkles />
              )}
              {drafts.length > 0 ? "Regenerate" : "Generate drafts"}
            </Button>
            <AiCallsLeft />
          </div>
        </CardContent>
        {drafts.length > 0 ? (
          <div className="border-t border-border">
            {drafted ? (
              <p className={SUB_HEADER}>
                {`Drafted in ${APP_STORE_LOCALIZATIONS[drafted]}`}
              </p>
            ) : null}
            <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
              {drafts.map((draft) => (
                <DraftRow key={draft.field} draft={draft} />
              ))}
            </ul>
          </div>
        ) : null}
        <CardFooter>
          <span>{`Drafts are suggestions. ${PRODUCT_NAME} never writes to the store.`}</span>
        </CardFooter>
      </Card>
    </section>
  );
}
