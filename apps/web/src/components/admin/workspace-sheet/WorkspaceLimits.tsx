"use client";

import { useTranslations } from "next-intl";
import type { SupportWorkspaceDetail } from "@asobeast/shared";
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
import {
  onDemandRows,
  usageRows,
  type LabelledValue,
} from "@/lib/admin-support";
import { useAppLocale } from "@/lib/use-app-locale";

function LimitTable({
  caption,
  captionClassName,
  valueHeader,
  rows,
}: {
  caption: string;
  captionClassName: string;
  valueHeader: string;
  rows: LabelledValue[];
}) {
  const t = useTranslations("admin");
  return (
    <Table density="compact">
      <TableCaption className={captionClassName}>{caption}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t("support.limit")}</TableHead>
          <TableHead numeric>{valueHeader}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="whitespace-normal">
              <span>{row.label}</span>
            </TableCell>
            <TableCell numeric className="whitespace-normal">
              <span>{row.value}</span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function WorkspaceLimits({
  workspace,
}: {
  workspace: SupportWorkspaceDetail;
}) {
  const t = useTranslations("admin");
  const locale = useAppLocale();
  const context = { translator: t, locale };
  const onDemand = onDemandRows(workspace.limits.onDemand, context);
  return (
    <SheetSection title={t("support.limitsTitle")}>
      <LimitTable
        caption={t("support.limitsTitle")}
        captionClassName="sr-only"
        valueHeader={t("support.usedAllowed")}
        rows={usageRows(workspace.limits, workspace, context)}
      />
      {onDemand.length > 0 ? (
        <LimitTable
          caption={t("support.onDemand")}
          captionClassName="mt-2 mb-2 caption-top text-left text-label text-muted-foreground"
          valueHeader={t("support.allowed")}
          rows={onDemand}
        />
      ) : null}
    </SheetSection>
  );
}
