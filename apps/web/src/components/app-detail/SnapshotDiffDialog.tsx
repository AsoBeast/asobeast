"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import type { SnapshotDiffResult } from "@asobeast/shared";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { returnFocusTo } from "@/lib/focus-handoff";
import { formatCountryInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { snapshotChangeCells, snapshotChangeLabel } from "./snapshot-change";

export function SnapshotDiffDialog({
  diff,
  market,
  open,
  onOpenChange,
  returnFocus,
}: {
  diff: SnapshotDiffResult | null;
  market: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocus?: RefObject<HTMLElement | null>;
}) {
  const t = useTranslations("appDetail");
  const locale = useAppLocale();
  const changes = diff?.changes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size={changes.length > 0 ? "lg" : "default"}
        onCloseAutoFocus={returnFocusTo(returnFocus)}
      >
        <DialogHeader>
          <DialogTitle>
            {market === null
              ? t("snapshot.refreshed")
              : t("snapshot.refreshedMarket", {
                  country: formatCountryInLocale(market, locale),
                })}
          </DialogTitle>
          <DialogDescription>
            {changes.length > 0
              ? t("snapshot.changed", { count: changes.length })
              : t("snapshot.unchanged")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {changes.length > 0 ? (
            <Table>
              <TableCaption className="sr-only">
                {t("snapshot.caption")}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("snapshot.field")}</TableHead>
                  <TableHead>{t("snapshot.before")}</TableHead>
                  <TableHead>{t("snapshot.after")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((change) => {
                  const cells = snapshotChangeCells(change, diff?.currency, {
                    translator: t,
                    locale,
                  });
                  return (
                    <TableRow
                      key={`${change.field}:${change.localization ?? ""}`}
                    >
                      <TableCell className="font-medium">
                        <span>
                          {snapshotChangeLabel(change, {
                            translator: t,
                            locale,
                          })}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-normal wrap-anywhere text-muted-foreground">
                        <span translate="no">{cells.before}</span>
                      </TableCell>
                      <TableCell className="whitespace-normal wrap-anywhere">
                        <span translate="no">{cells.after}</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-dense text-muted-foreground">
              {t("snapshot.noChanges")}
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
