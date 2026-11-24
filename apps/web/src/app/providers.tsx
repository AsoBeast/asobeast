"use client";

import { NextIntlClientProvider, type AbstractIntlMessages } from "next-intl";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ErrorReporter } from "@/components/layout/ErrorReporter";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getQueryClient } from "@/lib/get-query-client";
import type { Locale } from "@/lib/locale";

export function Providers({
  children,
  locale,
  messages,
}: {
  children: React.ReactNode;
  locale: Locale;
  messages: AbstractIntlMessages;
}) {
  const queryClient = getQueryClient();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <QueryClientProvider client={queryClient}>
        <ErrorReporter />
        <NuqsAdapter>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>{children}</TooltipProvider>
          </ThemeProvider>
        </NuqsAdapter>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}
