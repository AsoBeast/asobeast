import {
  SUPPORT_EMAIL,
  type BillingCatalog,
  type TrialOffer,
} from "@asobeast/shared";
import {
  InlineQueryError,
  type RetryableRead,
} from "@/components/layout/InlineQueryError";
import {
  CONTACT_SUPPORT,
  NEED_HELP,
  PRICES_UNREACHABLE,
  trialPaymentNote,
  type ViewerClock,
} from "@/lib/plan-choice";

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
  return (
    <>
      {catalogRead ? (
        <InlineQueryError message={PRICES_UNREACHABLE} read={catalogRead} />
      ) : null}
      <p className="text-caption text-muted-foreground">
        {catalogRead ? null : (
          <span>{`${trialPaymentNote(catalog, offer, clock)} `}</span>
        )}
        <span>{NEED_HELP}</span>{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium underline">
          {CONTACT_SUPPORT}
        </a>
        .
      </p>
    </>
  );
}
