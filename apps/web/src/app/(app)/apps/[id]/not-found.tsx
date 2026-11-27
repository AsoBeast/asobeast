import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default async function AppNotFound() {
  const t = await getTranslations("errors.boundary");
  return (
    <EmptyState
      title={t("appNotFoundTitle")}
      body={t("appNotFoundBody")}
      action={
        <Button asChild>
          <Link href="/">{t("appNotFoundBack")}</Link>
        </Button>
      }
    />
  );
}
