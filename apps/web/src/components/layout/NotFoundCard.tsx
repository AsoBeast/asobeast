"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PRODUCT_NAME } from "@/lib/brand";
import { LEDE } from "./panel-classes";

export function NotFoundCard({ backLabel }: { backLabel?: string }) {
  const t = useTranslations("ui");
  return (
    <div
      data-slot="not-found"
      className="page-reading flex flex-col items-center gap-4 py-16 text-center"
    >
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-title text-balance">{t("notFoundTitle")}</h1>
        <p className={LEDE}>{t("notFoundBody")}</p>
      </div>
      <Button asChild>
        <Link href="/" data-action="back">
          {backLabel ?? t("backToProduct", { product: PRODUCT_NAME })}
        </Link>
      </Button>
    </div>
  );
}
