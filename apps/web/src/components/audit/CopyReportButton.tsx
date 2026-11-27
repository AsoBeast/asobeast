"use client";

import { Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { AppAuditResult } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/copy-text";
import { auditMarkdown } from "./audit-report";

export function CopyReportButton({
  audit,
  app,
}: {
  audit: AppAuditResult;
  app: { name: string | null; country: string };
}) {
  const t = useTranslations("audit");
  const copy = async () => {
    if (await copyText(auditMarkdown(audit, app, t))) {
      toast.success(t("copy.success"));
    } else {
      toast.error(t("copy.failed"));
    }
  };

  return (
    <Button variant="outline" className="w-fit" onClick={() => void copy()}>
      <Copy />
      {t("copy.button")}
    </Button>
  );
}
