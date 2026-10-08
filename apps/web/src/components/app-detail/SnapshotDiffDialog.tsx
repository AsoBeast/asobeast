"use client";

import type { SnapshotDiffResult } from "@asobeast/shared";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCountry } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { snapshotChangeCells, snapshotChangeLabel } from "./snapshot-change";

export function SnapshotDiffDialog({
  diff,
  market,
  open,
  onOpenChange,
}: {
  diff: SnapshotDiffResult | null;
  market: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changes = diff?.changes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={changes.length > 0 ? "lg" : "default"}>
        <DialogHeader>
          <DialogTitle>
            {market === null
              ? "Snapshot refreshed"
              : `Snapshot refreshed in ${formatCountry(market)}`}
          </DialogTitle>
          <DialogDescription>
            {changes.length > 0
              ? `${changes.length} field${changes.length === 1 ? "" : "s"} changed since the last snapshot.`
              : "The store listing is unchanged since the last snapshot."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {changes.length > 0 ? (
            <Table>
              <TableCaption className="sr-only">
                Store listing fields that changed since the last snapshot, with
                before and after values.
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Before</TableHead>
                  <TableHead>After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map((change) => {
                  const cells = snapshotChangeCells(change);
                  return (
                    <TableRow
                      key={`${change.field}:${change.localization ?? ""}`}
                    >
                      <TableCell className="font-medium">
                        {snapshotChangeLabel(change)}
                      </TableCell>
                      <TableCell className="whitespace-normal wrap-anywhere text-muted-foreground">
                        {cells.before}
                      </TableCell>
                      <TableCell className="whitespace-normal wrap-anywhere">
                        {cells.after}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              No changes detected.
            </p>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
