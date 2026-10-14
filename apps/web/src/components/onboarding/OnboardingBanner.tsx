"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { pluralize } from "@/lib/format";
import { portfolioOptions } from "@/lib/queries";
import {
  bannerApps,
  progressPercent,
  progressSentence,
} from "./setup-progress";
import { useSetupDismissal } from "./use-setup-dismissal";

export function OnboardingBanner() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const dismiss = useSetupDismissal();
  const picked = bannerApps(data.apps);
  if (!picked) return null;
  const { app, more } = picked;

  return (
    <Alert
      role="status"
      className="items-center gap-y-3 sm:grid-cols-[auto_1fr_auto]"
    >
      <ListChecks />
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {progressSentence(app.name, app.setup)}
          {more > 0 ? (
            <>
              {" · "}
              <Link
                href="/?view=cards"
                className="underline decoration-primary underline-offset-4"
              >
                and {pluralize(more, "more app", "more apps")}
              </Link>
            </>
          ) : null}
        </span>
        <Progress
          value={progressPercent(app.setup)}
          aria-label="Setup progress"
          getValueLabel={() => `${app.setup.done} of ${app.setup.total} steps`}
          className="max-w-xs"
        />
      </AlertDescription>
      <div className="col-span-full flex flex-wrap gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2">
        <Button asChild size="sm">
          <Link href={`/apps/${app.id}/setup`}>Resume setup</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate(app.id)}
        >
          Dismiss
        </Button>
      </div>
    </Alert>
  );
}
