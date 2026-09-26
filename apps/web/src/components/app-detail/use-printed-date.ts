"use client";

import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { formatDate } from "@/lib/format";

function now() {
  return new Date().toISOString();
}

export function usePrintedDate() {
  const [printedAt, setPrintedAt] = useState(now);

  useEffect(() => {
    const stamp = () => flushSync(() => setPrintedAt(now()));
    window.addEventListener("beforeprint", stamp);
    return () => window.removeEventListener("beforeprint", stamp);
  }, []);

  return formatDate(printedAt);
}
