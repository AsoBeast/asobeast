"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import {
  ADMIN_SECTIONS,
  adminHref,
  adminSectionFrom,
} from "@/lib/admin-sections";
import { cn } from "@/lib/utils";
import { ADMIN_TOOLS } from "./admin-links";
import { useScrollEdges, type ScrollEdges } from "./scroll-edges";

const TAB_CLASS =
  "relative shrink-0 border-b-2 border-transparent px-3 py-2 text-dense whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none aria-[current=page]:border-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground";

const EDGE_FADE: Record<ScrollEdges, string | undefined> = {
  none: undefined,
  start: "[mask-image:linear-gradient(to_right,transparent,black_2.5rem)]",
  end: "[mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]",
  both: "[mask-image:linear-gradient(to_right,transparent,black_2.5rem,black_calc(100%-2.5rem),transparent)]",
};

export function AdminNav() {
  const current = adminSectionFrom(usePathname());
  const row = useRef<HTMLElement>(null);
  const edges = useScrollEdges(row);
  const t = useTranslations("admin");

  return (
    <nav
      ref={row}
      aria-label={t("nav.label")}
      data-edges={edges}
      className={cn(
        "flex min-w-0 items-end gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]",
        EDGE_FADE[edges],
      )}
    >
      {ADMIN_SECTIONS.map(({ segment, labelKey }) => (
        <Link
          key={segment || "overview"}
          href={adminHref(segment)}
          aria-current={current?.segment === segment ? "page" : undefined}
          className={TAB_CLASS}
        >
          {t(labelKey)}
        </Link>
      ))}
      <span aria-hidden className="mx-2 mb-2 h-4 w-px shrink-0 bg-border" />
      {ADMIN_TOOLS.map(({ href, labelKey }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`${TAB_CLASS} inline-flex items-center gap-1`}
        >
          {t(labelKey)}
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only"> {t("common.opensInNewTab")}</span>
        </a>
      ))}
    </nav>
  );
}
