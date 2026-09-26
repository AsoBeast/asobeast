"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCountry, formatNumber } from "@/lib/format";

export const keywordCount = (count: number) =>
  `${formatNumber(count)} keyword${count === 1 ? "" : "s"}`;

export function TrackCombinationsDialog({
  count,
  market,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: {
  count: number;
  market: string;
  open: boolean;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const storefront = formatCountry(market);
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Track {keywordCount(count)} in {storefront}?
          </DialogTitle>
          <DialogDescription>
            Each tracked keyword adds one store search a day in {storefront},
            counted against your daily request budget.{" "}
            <Link
              href="/settings#daily-capacity"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Review the daily request budget
            </Link>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button disabled={pending} onClick={onConfirm}>
            Track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
