"use client";

import Link from "next/link";
import { createTranslator, useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/use-auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import enKeywords from "../../../messages/en/keywords.json";
import type { MessageTranslator } from "@/i18n/translator";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

const english = createTranslator({
  locale: "en",
  namespace: "keywords",
  messages: { keywords: enKeywords },
});

export const keywordCount = (
  count: number,
  t: MessageTranslator = english,
): string => t("bulk.keywordCount", { count });

export function TrackCombinationsDialog({
  count,
  market,
  open,
  pending,
  onOpenChange,
  onConfirm,
  onCloseAutoFocus,
}: {
  count: number;
  market: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const t = useTranslations("keywords");
  const tCommon = useTranslations("common");
  const locale = useAppLocale();
  const storefront = formatCountryInLocale(market, locale);
  const { isOperator } = useAuth();
  const description = isOperator
    ? t.rich("combinations.operatorDescription", {
        country: storefront,
        budgetLink: (chunks) => (
          <Link
            href="/settings#daily-capacity"
            className="font-medium text-foreground underline underline-offset-4"
          >
            {chunks}
          </Link>
        ),
      })
    : t("combinations.trackDescription", { country: storefront });
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {t("combinations.trackTitle", {
              count: keywordCount(count, t),
              country: storefront,
            })}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            {tCommon("cancel")}
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            {t("suggestions.track")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
