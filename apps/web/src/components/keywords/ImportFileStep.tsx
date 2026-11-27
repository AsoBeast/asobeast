"use client";

import { Download, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { KEYWORD_IMPORT_LIMIT } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";

const TEMPLATE = toCsv(
  ["keyword", "country", "tags", "note"],
  [
    ["habit tracker", "us", "core; brand", "Launch keyword"],
    ["streak counter", "pl", "testing", null],
  ],
);

export function ImportFileStep({
  fileName,
  onChoose,
  disabled,
}: {
  fileName: string | null;
  onChoose: (file: File | undefined) => void;
  disabled: boolean;
}) {
  const t = useTranslations("keywords");
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="keyword-import-file">{t("import.file")}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="keyword-import-file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="peer sr-only"
          disabled={disabled}
          onChange={(event) => onChoose(event.target.files?.[0])}
        />
        <Button
          asChild
          variant="outline"
          size="sm"
          className="cursor-pointer peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:pointer-events-none peer-disabled:text-muted-foreground"
        >
          <label htmlFor="keyword-import-file">
            <FileUp aria-hidden />
            {fileName ? t("import.replace") : t("import.choose")}
          </label>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv("keyword-import-template.csv", TEMPLATE)}
        >
          <Download aria-hidden />
          {t("import.template")}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">
        {fileName === null
          ? t("import.fileHint", { limit: KEYWORD_IMPORT_LIMIT })
          : t("import.readingFile", {
              file: fileName,
              limit: KEYWORD_IMPORT_LIMIT,
            })}
      </p>
    </div>
  );
}
