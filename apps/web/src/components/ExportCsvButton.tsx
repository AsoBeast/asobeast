"use client";

import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { SubjectButton } from "@/components/SubjectButton";

type ExportCsvButtonProps = Omit<
  ComponentProps<typeof SubjectButton>,
  "icon" | "label"
>;

export function ExportCsvButton(props: ExportCsvButtonProps) {
  const t = useTranslations("common");
  return (
    <SubjectButton
      data-action="export-csv"
      icon={<Download aria-hidden />}
      label={t("export")}
      {...props}
    />
  );
}
