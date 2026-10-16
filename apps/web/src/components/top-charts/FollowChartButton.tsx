"use client";

import { useRef, useState, type RefCallback } from "react";
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
  AlertDialogTrigger,
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

function Following({
  follows,
  onStopped,
}: {
  follows: ChartFollowItem[];
  onStopped: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const stopped = useRef(false);
  const mutation = useUnfollowChart(() => {
    stopped.current = true;
    setConfirming(false);
    onStopped();
  });
  const unfollowOnce = useSingleFlight(mutation);

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          <Check aria-hidden />
          Following
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (stopped.current) event.preventDefault();
        }}
      >
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
  );
}

function Follow({
  category,
  missing,
  primary,
  buttonRef,
}: {
  category: ChartCategory;
  missing: CategoryCollection[];
  primary: boolean;
  buttonRef: RefCallback<HTMLButtonElement>;
}) {
  const mutation = useFollowCategory(category);
  const followOnce = useSingleFlight(mutation);

  return (
    <Button
      ref={buttonRef}
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
  const focusFollow = useRef(false);
  const claimFocus = (node: HTMLButtonElement | null) => {
    if (!node || !focusFollow.current) return;
    focusFollow.current = false;
    node.focus();
  };

  return missing.length === 0 ? (
    <Following
      follows={categoryFollows(category, follows)}
      onStopped={() => {
        focusFollow.current = true;
      }}
    />
  ) : (
    <Follow
      category={category}
      missing={missing}
      primary={primary}
      buttonRef={claimFocus}
    />
  );
}
