"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellPlus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { ChartFollowItem, ChartKey } from "@asobeast/shared";
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
import { followChart } from "@/lib/api";
import { invalidateChartMutation } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import { followErrorText } from "./chart-actions";
import { chartTitle } from "./chart-params";
import { useUnfollowChart } from "./use-unfollow-chart";

function Following({ follow }: { follow: ChartFollowItem }) {
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
            <AlertDialogTitle>Stop following this chart?</AlertDialogTitle>
            <AlertDialogDescription>
              The daily run stops capturing it; stored days stay.
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
                unfollowOnce(follow.id);
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

function Follow({ chart, primary }: { chart: ChartKey; primary: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => followChart(chart),
    onSuccess: () => {
      invalidateChartMutation(queryClient);
      toast.success(
        `Following ${chartTitle(chart)}; the daily run captures it from tomorrow`,
      );
    },
    onError: (error) => toast.error(followErrorText(error)),
  });
  const followOnce = useSingleFlight(mutation);

  return (
    <Button
      variant={primary ? "default" : "outline"}
      disabled={mutation.isPending}
      onClick={() => followOnce()}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <BellPlus aria-hidden />
      )}
      Follow chart
    </Button>
  );
}

export function FollowChartButton({
  chart,
  followed,
  primary,
}: {
  chart: ChartKey;
  followed: ChartFollowItem | null;
  primary: boolean;
}) {
  return followed ? (
    <Following follow={followed} />
  ) : (
    <Follow chart={chart} primary={primary} />
  );
}
