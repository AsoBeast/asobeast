"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { adminHref } from "@/lib/admin-sections";
import { adminNounLabel, type AdminNoun } from "./admin-search";

export function ListLimitNote({
  shown,
  total,
  noun,
}: {
  shown: number;
  total: number;
  noun: AdminNoun;
}) {
  const t = useTranslations("admin");
  if (total <= shown) return null;
  const label = adminNounLabel(noun, total, t);

  return (
    <p className="text-dense text-muted-foreground">
      {t.rich("common.limitNote", {
        shown,
        total,
        noun: label,
        link: (chunks) => (
          <Link
            href={adminHref("workspaces")}
            className="font-medium text-foreground link-underline"
          >
            {chunks}
          </Link>
        ),
      })}
    </p>
  );
}
