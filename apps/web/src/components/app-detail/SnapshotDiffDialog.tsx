"use client";

import type { SnapshotChange, SnapshotDiffResult } from "@asobeast/shared";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function cell(value: SnapshotChange["before"]): string {
  return value === null || value === "" ? "—" : String(value);
}

export function SnapshotDiffDialog({
  diff,
  open,
  onOpenChange,
}: {
  diff: SnapshotDiffResult | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const changes = diff?.changes ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size={changes.length > 0 ? "lg" : "default"}>
        <DialogHeader>
          <DialogTitle>Snapshot refreshed</DialogTitle>
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
                {changes.map((change) => (
                  <TableRow key={change.field}>
                    <TableCell className="font-medium">
                      {change.field}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cell(change.before)}
                    </TableCell>
                    <TableCell>{cell(change.after)}</TableCell>
                  </TableRow>
                ))}
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
