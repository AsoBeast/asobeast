"use client";

import { useTheme } from "next-themes";
import type { CheckoutTheme } from "@asobeast/shared";
import { checkoutThemeOf } from "@/lib/embedded-checkout";

export function useCheckoutTheme(): CheckoutTheme | undefined {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === undefined
    ? undefined
    : checkoutThemeOf(resolvedTheme);
}
