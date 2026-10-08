"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { UPGRADE_PATH, type KeywordImportResult } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { quotaNotice } from "@/lib/keyword-import";

export function ImportQuotaNotice({
  result,
}: {
  result: Pick<KeywordImportResult, "summary" | "quota">;
}) {
  const notice = quotaNotice(result);
  if (notice === null) return null;
  return (
    <Alert role="note" variant="warning">
      <TriangleAlert aria-hidden />
      <AlertDescription>
        {notice.text}
        {notice.upgrade ? (
          <>
            {" "}
            <Button asChild variant="link" className="h-auto p-0">
              <Link href={UPGRADE_PATH}>See plans</Link>
            </Button>
          </>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
