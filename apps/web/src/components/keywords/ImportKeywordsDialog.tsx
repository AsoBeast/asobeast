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
import { columnOptions } from "@/lib/csv-import/parse-keyword-file";
import { fileNotices, importButtonLabel } from "@/lib/keyword-import";
import { ImportBudgetNotice } from "./ImportBudgetNotice";
import { ImportQuotaNotice } from "./ImportQuotaNotice";
import { ImportFileStep } from "./ImportFileStep";
import { ImportMapping } from "./ImportMapping";
import { ImportPreview } from "./ImportPreview";
import { useKeywordImport } from "./useKeywordImport";

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
          ignoredColumns: mapped.ignoredColumns,
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
              options={columnOptions(loaded.file, view)}
              onViewChange={flow.setView}
            />
          ) : null}
          {flow.error ? (
            <Alert variant="destructive">
              <AlertDescription>{flow.error}</AlertDescription>
            </Alert>
          ) : null}
          {result && mapped ? (
            <>
              <ImportPreview
                result={result}
                lines={mapped.lines}
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
          <Button disabled={!flow.canImport} onClick={flow.submit}>
            {flow.importing ? <Loader2 className="animate-spin" /> : null}
            {flow.importing
              ? "Importing…"
              : result
                ? importButtonLabel(result.summary)
                : "Nothing to import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
