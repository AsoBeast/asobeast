"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { UPGRADE_PATH, type KeywordImportResult } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { quotaNotice } from "@/lib/keyword-import";
import { useAppLocale } from "@/lib/use-app-locale";

export function ImportQuotaNotice({
  result,
}: {
  result: Pick<KeywordImportResult, "summary" | "quota">;
}) {
  const t = useTranslations("billing");
  const tKeywords = useTranslations("keywords");
  const locale = useAppLocale();
  const notice = quotaNotice(result, { translator: t, locale }, tKeywords);
  if (notice === null) return null;
  return (
    <Alert role="note" variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        <span>{notice.text}</span>
        {notice.upgrade ? (
          <>
            {" "}
            <Button asChild variant="link" className="h-auto p-0">
              <Link href={UPGRADE_PATH}>
                <span>{t("ai.seePlans")}</span>
              </Link>
            </Button>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
