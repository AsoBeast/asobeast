import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import type { ClosedAdminAccess } from "@/lib/admin-access";

const GUIDE_URL =
  "https://docs.asobeast.com/security/admin-surfaces#when-the-operators-workspace-has-no-plan";

export async function AdminAccessNotice({
  access,
}: {
  access: ClosedAdminAccess;
}) {
  const t = await getTranslations("admin");
  const copy = {
    "needs-plan": {
      title: t("access.needsPlanTitle"),
      body: t("access.needsPlanBody"),
    },
  }[access];

  return (
    <section
      aria-labelledby="admin-access-title"
      className="flex flex-col items-center gap-4 py-16 text-center"
    >
      <div className="flex flex-col gap-1">
        <h2 id="admin-access-title" className="text-heading">
          {copy.title}
        </h2>
        <p className="max-w-lg text-body text-muted-foreground">{copy.body}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/upgrade">{t("access.choosePlan")}</Link>
        </Button>
        <Button asChild variant="outline">
          <a href={GUIDE_URL} target="_blank" rel="noreferrer">
            {t("access.readGuide")}
            <span className="sr-only"> {t("common.opensInNewTab")}</span>
          </a>
        </Button>
      </div>
    </section>
  );
}
