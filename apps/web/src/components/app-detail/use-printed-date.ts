"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { formatDateInLocale } from "@/lib/format";
import { useAppLocale } from "@/lib/use-app-locale";

function now() {
  return new Date().toISOString();
}

export function usePrintedDate() {
  const locale = useAppLocale();
  const [printedAt, setPrintedAt] = useState(now);

  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(now()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  return formatDateInLocale(printedAt, locale);
}
