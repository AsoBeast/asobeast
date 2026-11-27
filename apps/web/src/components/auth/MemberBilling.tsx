"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { AccountPlan } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { memberPlanLine } from "@/lib/plan-choice";
import { useAppLocale } from "@/lib/use-app-locale";
import { AuthCard } from "./AuthCard";

export function MemberBilling({ plan }: { plan: AccountPlan | undefined }) {
  const t = useTranslations("billing");
  const account = useTranslations("account");
  const locale = useAppLocale();

  return (
    <AuthCard
      title={t("member.title")}
      description={memberPlanLine(plan, { translator: t, locale })}
      width="wall"
      className="my-auto"
    >
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/">
            <span>{account("memberBilling.backToApps")}</span>
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/settings#team">
            <span>{account("memberBilling.seeTeam")}</span>
          </Link>
        </Button>
      </div>
    </AuthCard>
  );
}
