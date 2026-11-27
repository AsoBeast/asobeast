"use client";

import { useTranslations } from "next-intl";
import type { SupportRunDay } from "@asobeast/shared";
import { SheetSection } from "@/components/layout/SheetSection";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDayMonthInLocale, formatNumberInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";
import { SectionEmpty, SectionNote } from "./SectionNote";

export function WorkspaceChecks({ days }: { days: SupportRunDay[] }) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  return (
    <SheetSection title={t("support.checks.title")}>
      {days.length === 0 ? (
        <SectionEmpty>{t("support.checks.empty")}</SectionEmpty>
      ) : (
        <Table density="compact">
          <TableCaption className="sr-only">
            {t("support.checks.caption")}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>{t("support.checks.day")}</TableHead>
              <TableHead numeric>{t("support.checks.checked")}</TableHead>
              <TableHead numeric>{t("support.checks.notFound")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {days.map((day) => (
              <TableRow key={day.date}>
                <TableCell>
                  <span>{formatDayMonthInLocale(day.date, locale)}</span>
                </TableCell>
                <TableCell numeric>
                  <span>{formatNumberInLocale(day.captured, locale)}</span>
                </TableCell>
                <TableCell numeric>
                  <span>{formatNumberInLocale(day.unresolved, locale)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <SectionNote>{t("support.checks.note")}</SectionNote>
    </SheetSection>
  );
}
