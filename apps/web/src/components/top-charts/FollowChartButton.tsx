"use client";

import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { BellPlus, Check, Loader2 } from "lucide-react";
import type { CategoryCollection, ChartFollowItem } from "@asobeast/shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { chartFollowsOptions } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  categoryFollows,
  missingKinds,
  type ChartCategory,
} from "./chart-follows";
import { useFollowCategory } from "./use-follow-category";
import { useUnfollowChart } from "./use-unfollow-chart";

function Following({ follows }: { follows: ChartFollowItem[] }) {
  const [confirming, setConfirming] = useState(false);
  const mutation = useUnfollowChart(() => setConfirming(false));
  const unfollowOnce = useSingleFlight(mutation);

  return (
    <>
      <Button variant="outline" onClick={() => setConfirming(true)}>
        <Check aria-hidden />
        Following
      </Button>
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop following this category?</AlertDialogTitle>
            <AlertDialogDescription>
              The daily run stops capturing its free, paid and grossing charts;
              stored days stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                unfollowOnce(follows.map((follow) => follow.id));
              }}
            >
              Stop following
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Follow({
  category,
  missing,
  primary,
}: {
  category: ChartCategory;
  missing: CategoryCollection[];
  primary: boolean;
}) {
  const mutation = useFollowCategory(category);
  const followOnce = useSingleFlight(mutation);

  return (
    <Button
      variant={primary ? "default" : "outline"}
      disabled={mutation.isPending}
      onClick={() => followOnce(missing)}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <BellPlus aria-hidden />
      )}
      Follow category
    </Button>
  );
}

export function FollowChartButton({
  category,
  primary,
}: {
  category: ChartCategory;
  primary: boolean;
}) {
  const { data: follows } = useSuspenseQuery(chartFollowsOptions);
  const missing = missingKinds(category, follows);

  return missing.length === 0 ? (
    <Following follows={categoryFollows(category, follows)} />
  ) : (
    <Follow category={category} missing={missing} primary={primary} />
  );
}
