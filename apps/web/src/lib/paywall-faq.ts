import type { TrialOffer } from "@asobeast/shared";
import { trialEndLabel } from "@/lib/plan-choice";

export interface FaqItem {
  question: string;
  answer: string;
  href?: string;
}

const CANCELLATION_GUIDE =
  "https://docs.asobeast.com/operations/billing#downgrade-and-cancellation";

const PRICING_GUIDE = "https://docs.asobeast.com/legal/pricing";

const STANDING_ITEMS: readonly FaqItem[] = [
  {
    question: "How do I cancel?",
    answer:
      "Open Settings, then Billing, and cancel in the billing portal. A trial cancelled before its end is never charged; a paid plan runs to the end of the period you paid for.",
    href: CANCELLATION_GUIDE,
  },
  {
    question: "Is my card safe with AsoBeast?",
    answer:
      "The card fields are Stripe's and the number never reaches AsoBeast. AsoBeast is open source; the code behind this page is on GitHub.",
    href: "https://github.com/AsoBeast/asobeast",
  },
  {
    question: "What is a keyword market?",
    answer:
      "One phrase tracked in one storefront. The same phrase in two countries is two keyword markets.",
    href: PRICING_GUIDE,
  },
  {
    question: "What counts as an app?",
    answer:
      "An app you import and track. Its competitors do not count against the limit; each plan sets how many competitors an app may have.",
    href: PRICING_GUIDE,
  },
  {
    question: "Can I change the plan later?",
    answer:
      "Yes, from Settings. An upgrade applies at once; a downgrade applies at the end of the period.",
    href: CANCELLATION_GUIDE,
  },
  {
    question: "How do I delete my account?",
    answer:
      "From Settings, Workspace. The deletion waits a few days and can be cancelled until then.",
    href: "https://docs.asobeast.com/legal/data-retention",
  },
];

function chargeItem(
  offer: TrialOffer | null | undefined,
  priceLabel: string,
  now: Date,
): FaqItem {
  if (!offer) {
    return {
      question: "When am I charged?",
      answer: "Today, for the first period. The plan renews until you cancel.",
    };
  }
  const endsOn = trialEndLabel(offer, now);
  return {
    question: "Will I be charged today?",
    answer: `No. Your card is verified today and nothing is charged. ${priceLabel} is charged on ${endsOn} unless you cancel from settings before then.`,
  };
}

export function paywallFaq(
  offer: TrialOffer | null | undefined,
  priceLabel: string,
  now: Date,
): readonly FaqItem[] {
  return [chargeItem(offer, priceLabel, now), ...STANDING_ITEMS];
}
