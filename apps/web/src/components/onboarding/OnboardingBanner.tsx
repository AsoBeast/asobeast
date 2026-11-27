"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ListChecks } from "lucide-react";
import Link from "next/link";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { portfolioOptions } from "@/lib/queries";
import {
  bannerApps,
  progressPercent,
  progressSentence,
  progressValueLabel,
  type AppInSetup,
} from "./setup-progress";
import { useSetupDismissal } from "./use-setup-dismissal";

export function OnboardingBanner() {
  const { data } = useSuspenseQuery(portfolioOptions);
  const picked = bannerApps(data.apps);
  return picked ? <SetupBanner app={picked.app} more={picked.more} /> : null;
}

function SetupBanner({ app, more }: { app: AppInSetup; more: number }) {
  const t = useTranslations("setup");
  const dismiss = useSetupDismissal(app.id);

  return (
    <Alert
      role="status"
      className="items-center gap-y-3 sm:grid-cols-[auto_1fr_auto]"
    >
      <ListChecks />
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {progressSentence(app.name, app.setup, t)}
          {more > 0 ? (
            <>
              {" · "}
              {t.rich("banner.moreApps", {
                count: more,
                link: (chunks) => (
                  <Link href="/?view=cards" className="link-underline">
                    {chunks}
                  </Link>
                ),
              })}
            </>
          ) : null}
        </span>
        <Progress
          value={progressPercent(app.setup)}
          aria-label={t("banner.progressAria")}
          getValueLabel={() => progressValueLabel(app.setup, t)}
          className="max-w-xs"
        />
      </AlertDescription>
      <div className="col-span-full flex flex-wrap gap-2 sm:col-span-1 sm:col-start-3 sm:row-span-2">
        <Button asChild size="sm">
          <Link href={`/apps/${app.id}/setup`}>{t("banner.resume")}</Link>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={dismiss.isPending}
          onClick={() => dismiss.mutate()}
        >
          {t("banner.dismiss")}
        </Button>
      </div>
    </Alert>
  );
}
