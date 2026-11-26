"use client";

import { useTranslations } from "next-intl";
import {
  NEW_TAB_LINK,
  PRIVACY_POLICY_URL,
  TERMS_OF_SERVICE_URL,
} from "@/lib/legal";

const LINKS = [
  { href: TERMS_OF_SERVICE_URL, label: "termsOfService" },
  { href: PRIVACY_POLICY_URL, label: "privacyPolicy" },
] as const;

export function LegalLinks() {
  const t = useTranslations("legal");
  return (
    <p className="flex flex-wrap gap-x-3 text-caption text-muted-foreground">
      {LINKS.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          {...NEW_TAB_LINK}
          className="rounded-sm py-1 link-underline hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {t(label)}
        </a>
      ))}
    </p>
  );
}
