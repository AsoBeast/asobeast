"use client";

import { Suspense, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Copy, Loader2, PencilLine, Sparkles } from "lucide-react";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import {
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
import { copyText } from "@/lib/copy-text";
import { isListingDraftField } from "@/lib/listing-draft";
import { invalidateAiUsage } from "@/lib/queries";
import { localizationNameInLocale } from "@/lib/localizations";
import { metadataFieldLabel } from "@/lib/metadata-display";
import { useAppLocale } from "@/lib/use-app-locale";
import { draftLocaleParser } from "@/lib/search-params";
import { useSingleFlight } from "@/lib/single-flight";
import { DraftLocalizationSelect } from "./DraftLocalizationSelect";
import { useDraftFill } from "./draft/use-draft-fill";
import { DraftLocalizationSkeleton } from "./skeletons";
import { LintIssueRow } from "./LintIssueRow";

const STORE_FIELDS: Record<Store, MetadataField[]> = {
  APP_STORE: ["title", "subtitle", "keywordField"],
  GOOGLE_PLAY: ["title", "shortDescription", "description"],
};

function DraftRow({
  draft,
  onUse,
}: {
  draft: MetadataDraft;
  onUse: ((draft: MetadataDraft) => void) | null;
}) {
  const t = useTranslations("metadata");
  const label = metadataFieldLabel(draft.field, t);

  async function copy() {
    if (await copyText(draft.value)) {
      toast.success(t("assistant.copied", { field: label }));
    } else {
      toast.error(t("assistant.copyFailed"));
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
        <div className="flex flex-wrap items-center gap-2">
          {onUse && isListingDraftField(draft.field) ? (
            <Button
              variant="outline"
              size="sm"
              aria-label={t("assistant.useInDraftAria", { field: label })}
              onClick={() => onUse(draft)}
            >
              <PencilLine aria-hidden />
              <span>{t("assistant.useInDraft")}</span>
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            aria-label={t("assistant.copyAria", { field: label })}
            onClick={copy}
          >
            <Copy aria-hidden />
            <span>{t("assistant.copy")}</span>
          </Button>
        </div>
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
  const t = useTranslations("metadata");
  const locale = useAppLocale();
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
    onError: (error) => failAi(error, t("assistant.generationFailed")),
    onSettled: () => invalidateAiUsage(queryClient),
  });
  const draftOnce = useSingleFlight(mutation);

  const drafts = mutation.data?.drafts ?? [];
  const drafted = mutation.data?.localization ?? null;
  const useInDraft = useDraftFill(appId, store, drafted);

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
            <h2 id={headingId}>{t("assistant.title")}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {canLocalize ? (
            <Suspense fallback={<DraftLocalizationSkeleton />}>
              <DraftLocalizationSelect appId={appId} />
            </Suspense>
          ) : null}
          <div className="flex flex-col gap-2">
            <Label htmlFor={instructionsId}>
              {t("assistant.instructions")}
            </Label>
            <Textarea
              id={instructionsId}
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder={t("assistant.placeholder")}
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
                <span>{metadataFieldLabel(field, t)}</span>
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
              {drafts.length > 0
                ? t("assistant.regenerate")
                : t("assistant.generate")}
            </Button>
            <AiCallsLeft />
          </div>
        </CardContent>
        {drafts.length > 0 ? (
          <div className="border-t border-border">
            {drafted ? (
              <p className={SUB_HEADER}>
                {t("assistant.draftedIn", {
                  language: localizationNameInLocale(drafted, locale),
                })}
              </p>
            ) : null}
            <ul className="flex list-none flex-col divide-y divide-border-subtle p-0">
              {drafts.map((draft) => (
                <DraftRow key={draft.field} draft={draft} onUse={useInDraft} />
              ))}
            </ul>
          </div>
        ) : null}
        <CardFooter>
          <span>{t("assistant.footer", { product: PRODUCT_NAME })}</span>
        </CardFooter>
      </Card>
    </section>
  );
}
