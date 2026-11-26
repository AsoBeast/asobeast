import { useTranslations } from "next-intl";
import {
  SUPPORT_EMAIL,
  type BillingCatalog,
  type TrialOffer,
} from "@asobeast/shared";
import {
  InlineQueryError,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import { trialPaymentNote, type ViewerClock } from "@/lib/plan-choice";
import { useAppLocale } from "@/lib/use-app-locale";

export function PaymentNote({
  catalog,
  catalogRead,
  offer,
  clock,
}: {
  catalog: BillingCatalog | undefined;
  catalogRead: RetryableRead | null;
  offer: TrialOffer | null | undefined;
  clock: ViewerClock;
}) {
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const context = { translator: t, locale };

  return (
    <>
      {catalogRead ? (
        <InlineQueryError
          message={t("payment.pricesUnreachable")}
          read={catalogRead}
        />
      ) : null}
      <p className="text-caption text-muted-foreground">
        {catalogRead ? null : (
          <span>{`${trialPaymentNote(catalog, offer, clock, context)} `}</span>
        )}
        {t.rich("payment.support", {
          link: (chunks) => (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-foreground link-underline"
            >
              <span>{chunks}</span>
            </a>
          ),
        })}
      </p>
    </>
  );
}
