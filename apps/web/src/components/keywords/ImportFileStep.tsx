"use client";

import { Download } from "lucide-react";
import { KEYWORD_IMPORT_LIMIT } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatNumber } from "@/lib/format";

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
}: {
  fileName: string | null;
  onChoose: (file: File | undefined) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="keyword-import-file">Keyword file</Label>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="keyword-import-file"
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          className="max-w-xs"
          onChange={(event) => onChoose(event.target.files?.[0])}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadCsv("keyword-import-template.csv", TEMPLATE)}
        >
          <Download aria-hidden />
          Download template
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {fileName
          ? `Reading ${fileName}. Up to ${formatNumber(KEYWORD_IMPORT_LIMIT)} rows per import.`
          : `Up to ${formatNumber(KEYWORD_IMPORT_LIMIT)} rows per import. UTF-8 or UTF-16, separated by commas, semicolons, tabs or pipes.`}
      </p>
    </div>
  );
}
