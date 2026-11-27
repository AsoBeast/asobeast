"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { budgetOptions } from "@/lib/queries";
import { utilizationLevel } from "@/lib/utilization";

export function BudgetBanner() {
  const t = useTranslations("settings");
  const { data: budget } = useSuspenseQuery(budgetOptions);
  if (utilizationLevel(budget.utilization) !== "danger") {
    return null;
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>
        {t.rich("capacity.banner", {
          link: (chunks) => (
            <Link href="/settings" className="font-medium underline">
              <span>{chunks}</span>
            </Link>
          ),
        })}
      </AlertDescription>
    </Alert>
  );
}
