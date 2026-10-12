"use client";

import { useId, useState } from "react";
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
import { formatCountry } from "@/lib/format";
import { localizationName } from "@/lib/localizations";
import { ReadRoleBadge } from "./ReadRoleBadge";

export function SaveKeywordFieldDialog({
  preview,
  pending,
  error,
  onConfirm,
  onClose,
}: {
  preview: KeywordFieldSavePreview;
  pending: boolean;
  error: string | null;
  onConfirm: (trackIn: string[]) => void;
  onClose: () => void;
}) {
  const groupId = useId();
  const name = localizationName(preview.localization);
  const [trackIn, setTrackIn] = useState<string[]>(() =>
    preview.markets.map((market) => market.country),
  );
  const cost = selectedCost(preview, trackIn);
  const quota = saveQuotaNotice(preview.quota, cost);
  const added = addedSentence(preview);
  const dropped = droppedSentence(preview);

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
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Save the {name} keyword field</DialogTitle>
          <DialogDescription>
            Choose the markets that should track its phrases. Every market on
            its list reads the field either way.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="gap-4">
          {added ? <p className="text-body text-foreground">{added}</p> : null}
          {dropped ? (
            <p className="text-body text-muted-foreground">{dropped}</p>
          ) : null}
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Markets that track the phrases</legend>
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
                    {formatCountry(market.country)}
                  </Label>
                  <ReadRoleBadge role={market.role} />
                  {market.newPhrases.length > 0 ? (
                    <span className="text-caption text-muted-foreground">
                      {market.newPhrases.length} new
                    </span>
                  ) : null}
                </div>
              );
            })}
          </fieldset>
          <Alert role="note">
            <Gauge aria-hidden />
            <AlertDescription>{saveCostText(cost)}</AlertDescription>
          </Alert>
          {quota ? (
            <Alert role="note" variant={quota.over ? "warning" : "default"}>
              {quota.over ? <TriangleAlert aria-hidden /> : null}
              <AlertDescription>
                {quota.text}
                {quota.upgrade ? (
                  <>
                    {" "}
                    <Button asChild variant="link" className="h-auto p-0">
                      <Link href={UPGRADE_PATH}>See plans</Link>
                    </Button>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || quota?.over === true}
            onClick={() => onConfirm(trackIn)}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending
              ? "Saving…"
              : trackIn.length === 0
                ? "Save"
                : "Save and track"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
