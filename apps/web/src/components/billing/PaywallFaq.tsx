"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { READ_MORE, readMoreContext, type FaqItem } from "@/lib/paywall-faq";
import { FAQ_TITLE } from "@/lib/plan-choice";

export function PaywallFaq({ items }: { items: readonly FaqItem[] }) {
  return (
    <section
      aria-labelledby="paywall-faq-title"
      className="flex min-w-0 flex-col gap-4"
    >
      <h2 id="paywall-faq-title" className="text-display">
        {FAQ_TITLE}
      </h2>
      <Accordion
        type="single"
        collapsible
        className="grid items-start gap-3 sm:grid-cols-2"
      >
        {items.map(({ question, answer, href }) => (
          <AccordionItem
            key={question}
            value={question}
            className="rounded-xl border border-border bg-card px-4"
          >
            <AccordionTrigger className="py-4 text-subtitle">
              {question}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col items-start gap-2 pb-4 text-body text-muted-foreground">
              <p>{answer}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline decoration-primary underline-offset-4"
                >
                  {READ_MORE}
                  <span className="sr-only">{readMoreContext(question)}</span>
                </a>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
