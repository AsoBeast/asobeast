"use client";

import Link from "next/link";
import { useSuspenseQuery } from "@tanstack/react-query";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { budgetOptions } from "@/lib/queries";

const DANGER = 0.85;

export function BudgetBanner() {
  const { data: budget } = useSuspenseQuery(budgetOptions);
  if (budget.utilization <= DANGER) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>
        Daily requests exceed 85% of your store rate limit.{" "}
        <Link href="/settings" className="font-medium underline">
          Review the request budget
        </Link>
        .
      </AlertDescription>
    </Alert>
  );
}
