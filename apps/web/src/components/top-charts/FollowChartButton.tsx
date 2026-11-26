"use client";

import { useRef, useState, type RefCallback } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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
import { armFocusHandoff, useFocusClaim } from "@/lib/focus-handoff";
import { chartFollowsOptions } from "@/lib/queries";
import { useSingleFlight } from "@/lib/single-flight";
import {
  categoryFollows,
  missingKinds,
  type ChartCategory,
} from "./chart-follows";
import { useFollowCategory } from "./use-follow-category";
import { useUnfollowChart } from "./use-unfollow-chart";

const FOLLOW_FOCUS_KEY = "chart-follow";
const armFollowFocus = () => armFocusHandoff(FOLLOW_FOCUS_KEY);

function Following({
  follows,
  claimRef,
  onActivate,
}: {
  follows: ChartFollowItem[];
  claimRef: RefCallback<HTMLElement>;
  onActivate: () => void;
}) {
  const t = useTranslations("topCharts");
  const common = useTranslations("common");
  const [confirming, setConfirming] = useState(false);
  const stopped = useRef(false);
  const mutation = useUnfollowChart(() => {
    stopped.current = true;
    setConfirming(false);
  });
  const unfollowOnce = useSingleFlight(mutation);

  return (
    <AlertDialog open={confirming} onOpenChange={setConfirming}>
      <AlertDialogTrigger asChild>
        <Button ref={claimRef} variant="outline">
          <Check aria-hidden />
          {t("capture.following")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          if (stopped.current) event.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{t("capture.stopTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("capture.stopDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>
            {common("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={mutation.isPending}
            onClick={(event) => {
              event.preventDefault();
              onActivate();
              unfollowOnce(follows.map((follow) => follow.id));
            }}
          >
            {t("capture.stopFollowing")}
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
  onActivate,
}: {
  category: ChartCategory;
  missing: CategoryCollection[];
  primary: boolean;
  buttonRef: RefCallback<HTMLButtonElement>;
  onActivate: () => void;
}) {
  const t = useTranslations("topCharts");
  const mutation = useFollowCategory(category);
  const followOnce = useSingleFlight(mutation);

  return (
    <Button
      ref={buttonRef}
      variant={primary ? "default" : "outline"}
      aria-disabled={mutation.isPending || undefined}
      onClick={() => {
        onActivate();
        followOnce(missing);
      }}
    >
      {mutation.isPending ? (
        <Loader2 className="animate-spin" aria-hidden />
      ) : (
        <BellPlus aria-hidden />
      )}
      {t("capture.followCategory")}
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
  const claimFocus = useFocusClaim(FOLLOW_FOCUS_KEY);

  return missing.length === 0 ? (
    <Following
      follows={categoryFollows(category, follows)}
      claimRef={claimFocus}
      onActivate={armFollowFocus}
    />
  ) : (
    <Follow
      category={category}
      missing={missing}
      primary={primary}
      buttonRef={claimFocus}
      onActivate={armFollowFocus}
    />
  );
}
