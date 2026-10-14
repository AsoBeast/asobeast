"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { portfolioOptions } from "@/lib/queries";
import { progressPercent, progressSentence } from "./setup-progress";
import { useSetupDismissal } from "./use-setup-dismissal";

export function OnboardingBanner() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const dismiss = useSetupDismissal();
  const app = data.apps.find((item) => item.setup?.status === "in_progress");
  if (!app?.setup) return null;
  const { setup } = app;

  return (
    <Alert
      role="status"
      className="items-center gap-y-3 sm:grid-cols-[auto_1fr_auto]"
    >
      <ListChecks />
      <AlertDescription className="flex flex-col gap-2">
        <span>{progressSentence(app.name, setup)}</span>
        <Progress
          value={progressPercent(setup)}
          aria-label="Setup progress"
          getValueLabel={() => `${setup.done} of ${setup.total} steps`}
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
