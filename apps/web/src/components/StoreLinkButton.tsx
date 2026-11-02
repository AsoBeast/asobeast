import { ExternalLink } from "lucide-react";
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
  return (
    <Button variant="ghost" size="icon-sm" asChild>
      <a
        href={storeUrl(store, storeAppId, country)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${title} in the store`}
      >
        <ExternalLink aria-hidden />
      </a>
    </Button>
  );
}
