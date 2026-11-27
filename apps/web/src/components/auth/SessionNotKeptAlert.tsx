import Link from "next/link";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TROUBLESHOOTING_URL =
  "https://docs.asobeast.com/operations/troubleshooting#signing-in-returns-to-the-sign-in-form";

export function SessionNotKeptAlert({
  outcome,
  offerSignIn = false,
}: {
  outcome: string;
  offerSignIn?: boolean;
}) {
  const t = useTranslations("auth");
  return (
    <Alert variant="destructive">
      <AlertTitle>{t("session.notKeptTitle")}</AlertTitle>
      <AlertDescription className="[&_p:not(:last-child)]:mb-1">
        <p>{t("session.notKeptBody", { outcome })}</p>
        <p>
          {t.rich("session.troubleshooting", {
            guide: (chunks) => (
              <a href={TROUBLESHOOTING_URL} target="_blank" rel="noreferrer">
                {chunks}
              </a>
            ),
            symptom: t("session.symptom"),
          })}
        </p>
        {offerSignIn ? (
          <p>
            <Link href="/login">{t("session.goToSignIn")}</Link>
          </p>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
