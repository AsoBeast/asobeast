"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  ADMIN_SECTIONS,
  adminHref,
  adminSectionFrom,
} from "@/lib/admin-sections";
import { ADMIN_TOOLS } from "./admin-links";

const TAB_CLASS =
  "relative shrink-0 border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground focus-visible:rounded-sm focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset focus-visible:outline-none aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground";

export function AdminNav() {
  const current = adminSectionFrom(usePathname());

  return (
    <nav
      aria-label="Admin"
      className="flex min-w-0 items-end gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
    >
      {ADMIN_SECTIONS.map(({ segment, label }) => (
        <Link
          key={segment || "overview"}
          href={adminHref(segment)}
          aria-current={current?.segment === segment ? "page" : undefined}
          className={TAB_CLASS}
        >
          {label}
        </Link>
      ))}
      <span aria-hidden className="mx-2 mb-2 h-4 w-px shrink-0 bg-border" />
      {ADMIN_TOOLS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          target="_blank"
          rel="noreferrer"
          className={`${TAB_CLASS} inline-flex items-center gap-1`}
        >
          {label}
          <ExternalLink aria-hidden className="size-3.5" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ))}
    </nav>
  );
}
