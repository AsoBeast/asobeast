"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { Store } from "@asobeast/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  columnOptions,
  skippedAboveHeader,
} from "@/lib/csv-import/parse-keyword-file";
import {
  fileNotices,
  importButtonLabel,
  skipButtonLabel,
} from "@/lib/keyword-import";
import { ImportBudgetNotice } from "./ImportBudgetNotice";
import { ImportQuotaNotice } from "./ImportQuotaNotice";
import { ImportFileStep } from "./ImportFileStep";
import { ImportMapping } from "./ImportMapping";
import { ImportPreview } from "./ImportPreview";
import { useKeywordImport } from "./useKeywordImport";

function primaryLabel({
  importing,
  action,
  progress,
  result,
}: Pick<
  ReturnType<typeof useKeywordImport>,
  "importing" | "action" | "progress" | "result"
>): string {
  if (importing) return "Importing…";
  if (action === "skip") return skipButtonLabel(progress);
  return result ? importButtonLabel(result.summary) : "Nothing to import";
}

export function ImportKeywordsDialog({
  appId,
  store,
  country,
  children,
}: {
  appId: string;
  store: Store;
  country: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const flow = useKeywordImport(appId, store, country, () => setOpen(false));

  function onOpenChange(next: boolean) {
    if (flow.importing) return;
    setOpen(next);
    flow.reset(country);
  }

  const { loaded, view, mapped, result } = flow;
  const notices =
    loaded && view && mapped
      ? fileNotices({
          fallback: loaded.file.fallback,
          hasHeader: view.hasHeader,
          skippedRows: skippedAboveHeader(loaded.file, view),
          ignoredColumns: mapped.ignoredColumns,
          store,
          leftOut: mapped.leftOut,
          appsToChoose: flow.appsToChoose,
        })
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Import keywords from CSV</DialogTitle>
          <DialogDescription>
            Choose a file with one keyword per row. Country, tags and note are
            optional columns. Nothing is saved until you confirm.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="gap-4">
          <ImportFileStep
            fileName={loaded?.name ?? null}
            onChoose={flow.choose}
            disabled={flow.importing}
          />
          {notices.map((notice) => (
            <Alert key={notice} role="note" variant="warning">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ))}
          {loaded && view ? (
            <ImportMapping
              store={store}
              market={flow.market}
              onMarketChange={flow.setMarket}
              view={view}
              scope={loaded.file.scope}
              options={columnOptions(loaded.file, view)}
              onViewChange={flow.setView}
              disabled={flow.importing}
            />
          ) : null}
          {flow.error ? (
            <Alert variant="destructive">
              <AlertDescription>{flow.error}</AlertDescription>
            </Alert>
          ) : null}
          {flow.partNotice ? (
            <Alert role="note">
              <AlertDescription>{flow.partNotice}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <>
              <ImportPreview
                result={result}
                lines={flow.lines}
                busy={flow.busy}
              />
              <ImportQuotaNotice result={result} />
              <ImportBudgetNotice cost={result.cost} />
            </>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button
            variant="outline"
            disabled={flow.importing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            aria-disabled={flow.action === null}
            onClick={() => {
              if (flow.action === "import") flow.submit();
              if (flow.action === "skip") flow.skip();
            }}
          >
            {flow.importing ? <Loader2 className="animate-spin" /> : null}
            {primaryLabel(flow)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
