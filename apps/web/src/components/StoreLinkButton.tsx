"use client";

import { ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Store } from "@asobeast/shared";
import { Button } from "@/components/ui/button";
import { storeUrl } from "@/lib/store-url";

export function StoreLinkButton({
  store,
  storeAppId,
  country,
  title,
}: {
  store: Store;
  storeAppId: string;
  country: string;
  title: string;
}) {
  const t = useTranslations("ui");
  return (
    <Button variant="ghost" size="icon-sm" asChild>
      <a
        data-action="open-store"
        href={storeUrl(store, storeAppId, country)}
        target="_blank"
        rel="noreferrer"
        aria-label={t("openInStore", { title })}
      >
        <ExternalLink aria-hidden />
      </a>
    </Button>
  );
}
