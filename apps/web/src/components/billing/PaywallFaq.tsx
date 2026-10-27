"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { FaqItem } from "@/lib/paywall-faq";
import { FAQ_TITLE } from "@/lib/plan-choice";

export function PaywallFaq({ items }: { items: readonly FaqItem[] }) {
  return (
    <section
      aria-labelledby="paywall-faq-title"
      className="flex flex-col gap-2"
    >
      <h2 id="paywall-faq-title" className="text-title">
        {FAQ_TITLE}
      </h2>
      <Accordion type="single" collapsible>
        {items.map(({ question, answer, href }) => (
          <AccordionItem key={question} value={question}>
            <AccordionTrigger className="text-body font-medium">
              {question}
            </AccordionTrigger>
            <AccordionContent className="flex flex-col items-start gap-1 text-body text-muted-foreground">
              <p>{answer}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline decoration-primary underline-offset-4"
                >
                  Read more
                  <span className="sr-only">
                    {" "}
                    about {question} (opens in a new tab)
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
