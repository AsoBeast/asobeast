"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Gauge, Loader2, TriangleAlert } from "lucide-react";
import { UPGRADE_PATH, type KeywordFieldSavePreview } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  addedSentence,
  droppedSentence,
  saveCostText,
  saveQuotaNotice,
  selectedCost,
} from "@/lib/app-localizations";
import { formatCountryInLocale } from "@/lib/format";
import { localizationNameInLocale } from "@/lib/localizations";
import { useAppLocale } from "@/lib/use-app-locale";
import { ReadRoleBadge } from "./ReadRoleBadge";

export function SaveKeywordFieldDialog({
  preview,
  pending,
  error,
  onConfirm,
  onClose,
  returnFocus,
}: {
  preview: KeywordFieldSavePreview;
  pending: boolean;
  error: string | null;
  onConfirm: (trackIn: string[]) => void;
  onClose: () => void;
  returnFocus: () => void;
}) {
  const t = useTranslations("localizations");
  const common = useTranslations("common");
  const locale = useAppLocale();
  const groupId = useId();
  const name = localizationNameInLocale(preview.localization, locale);
  const [trackIn, setTrackIn] = useState<string[]>(() =>
    preview.markets.map((market) => market.country),
  );
  const cost = selectedCost(preview, trackIn);
  const quota = saveQuotaNotice(preview.quota, cost, t);
  const added = addedSentence(preview, t);
  const dropped = droppedSentence(preview, t, locale);

  function toggle(country: string, checked: boolean) {
    setTrackIn((current) =>
      checked
        ? [...current, country]
        : current.filter((entry) => entry !== country),
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <DialogContent
        size="md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("saveDialog.title", { name })}</DialogTitle>
          <DialogDescription>{t("saveDialog.description")}</DialogDescription>
        </DialogHeader>

        <DialogBody className="gap-4">
          {added ? <p className="text-body text-foreground">{added}</p> : null}
          {dropped ? (
            <p className="text-body text-muted-foreground">{dropped}</p>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("saveDialog.legend")}</legend>
            {preview.markets.map((market) => {
              const checkboxId = `${groupId}-${market.country}`;
              return (
                <div
                  key={market.country}
                  className="flex flex-wrap items-center gap-2"
                >
                  <Checkbox
                    id={checkboxId}
                    checked={trackIn.includes(market.country)}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      toggle(market.country, checked === true)
                    }
                  />
                  <Label htmlFor={checkboxId}>
                    {formatCountryInLocale(market.country, locale)}
                  </Label>
                  <ReadRoleBadge role={market.role} />
                  {market.newPhrases.length > 0 ? (
                    <span className="text-caption text-muted-foreground">
                      {t("saveDialog.newCount", {
                        count: market.newPhrases.length,
                      })}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
          <Alert role="note">
            <Gauge aria-hidden />
            <AlertDescription>{saveCostText(cost, t)}</AlertDescription>
          </Alert>
          {quota ? (
            <Alert role="note" variant={quota.over ? "warning" : "default"}>
              {quota.over ? <TriangleAlert aria-hidden /> : null}
              <AlertDescription>
                <span>{quota.text}</span>
                {quota.upgrade ? (
                  <>
                    {" "}
                    <Button asChild variant="link" className="h-auto p-0">
                      <Link href={UPGRADE_PATH}>
                        {t("saveDialog.seePlans")}
                      </Link>
                    </Button>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <p role="alert" className="text-dense text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onClose();
            }}
          >
            {common("cancel")}
          </Button>
          <Button
            disabled={quota?.over === true}
            aria-disabled={pending || undefined}
            onClick={() => {
              if (!pending) onConfirm(trackIn);
            }}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending
              ? t("saveDialog.saving")
              : trackIn.length === 0
                ? t("saveDialog.save")
                : t("saveDialog.saveAndTrack")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
