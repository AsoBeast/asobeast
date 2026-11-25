"use client";

import { Copy } from "lucide-react";
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
  const copy = async () => {
    if (await copyText(auditMarkdown(audit, app))) {
      toast.success("Report copied");
    } else {
      toast.error("Your browser blocked the clipboard");
    }
  };

  return (
    <Button variant="outline" className="w-fit" onClick={() => void copy()}>
      <Copy />
      Copy report
    </Button>
  );
}
