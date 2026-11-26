import type { TrialOffer } from "@asobeast/shared";
import type { TranslationContext } from "@/i18n/translator";
import { trialEndLabel, type ViewerClock } from "@/lib/plan-choice";

export type FaqId =
  | "charge"
  | "cancel"
  | "cardSafety"
  | "keywordMarket"
  | "app"
  | "changePlan"
  | "deleteAccount";

export interface FaqItem {
  id: FaqId;
  question: string;
  answer: string;
  href?: string;
}

export function readMoreContext(
  question: string,
  context: TranslationContext,
): string {
  return context.translator("faq.readMoreContext", { question });
}

const CANCELLATION_GUIDE =
  "https://docs.asobeast.com/operations/billing#downgrade-and-cancellation";

const PRICING_GUIDE = "https://docs.asobeast.com/legal/pricing";

const STANDING_ITEMS: readonly {
  id: Exclude<FaqId, "charge">;
  key: string;
  href: string;
}[] = [
  {
    id: "cancel",
    key: "cancel",
    href: CANCELLATION_GUIDE,
  },
  {
    id: "cardSafety",
    key: "cardSafety",
    href: "https://github.com/AsoBeast/asobeast",
  },
  {
    id: "keywordMarket",
    key: "keywordMarket",
    href: PRICING_GUIDE,
  },
  {
    id: "app",
    key: "app",
    href: PRICING_GUIDE,
  },
  {
    id: "changePlan",
    key: "changePlan",
    href: CANCELLATION_GUIDE,
  },
  {
    id: "deleteAccount",
    key: "deleteAccount",
    href: "https://docs.asobeast.com/legal/data-retention",
  },
];

function chargeItem(
  offer: TrialOffer | null | undefined,
  renewalTerms: string,
  clock: ViewerClock,
  context: TranslationContext,
): FaqItem {
  if (!offer) {
    return {
      id: "charge",
      question: context.translator("faq.chargeLater.question"),
      answer: context.translator("faq.chargeLater.answer", {
        terms: renewalTerms,
      }),
    };
  }
  return {
    id: "charge",
    question: context.translator("faq.chargeToday.question"),
    answer: context.translator("faq.chargeToday.answer", {
      date: trialEndLabel(offer, clock, context),
      terms: renewalTerms,
    }),
  };
}

export function paywallFaq(
  offer: TrialOffer | null | undefined,
  renewalTerms: string,
  clock: ViewerClock,
  context: TranslationContext,
): readonly FaqItem[] {
  return [
    chargeItem(offer, renewalTerms, clock, context),
    ...STANDING_ITEMS.map(({ id, key, href }) => ({
      id,
      question: context.translator(`faq.${key}.question`),
      answer: context.translator(`faq.${key}.answer`),
      href,
    })),
  ];
}
