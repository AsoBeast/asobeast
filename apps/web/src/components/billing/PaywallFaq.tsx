"use client";

import { useTranslations } from "next-intl";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { readMoreContext, type FaqItem } from "@/lib/paywall-faq";
import { useAppLocale } from "@/lib/use-app-locale";

export function PaywallFaq({ items }: { items: readonly FaqItem[] }) {
  const t = useTranslations("billing");
  const locale = useAppLocale();
  const context = { translator: t, locale };

  return (
    <section
      aria-labelledby="paywall-faq-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="paywall-faq-title" className="text-title">
        {t("faq.title")}
      </h2>
      <Accordion
        type="single"
        collapsible
        className="grid items-start gap-3 sm:grid-cols-2"
      >
        {items.map(({ id, question, answer, href }) => (
          <AccordionItem
            key={id}
            value={id}
            className="rounded-xl border border-border bg-card px-4"
          >
            <AccordionTrigger className="py-4 text-heading">
              <span>{question}</span>
            </AccordionTrigger>
            <AccordionContent className="flex flex-col items-start gap-2 pb-4 text-body text-muted-foreground">
              <p>{answer}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground link-underline"
                >
                  <span>{t("faq.readMore")}</span>
                  <span className="sr-only">
                    {readMoreContext(question, context)}
                  </span>
                </a>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
