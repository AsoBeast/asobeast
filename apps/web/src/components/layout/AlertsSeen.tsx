"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  laterOf,
  parseSeen,
  readSeenCookie,
  seenCookie,
} from "@/lib/alerts-seen";

interface AlertsSeen {
  seenAt: string | null;
  markSeen: (instant: string) => void;
}

const AlertsSeenContext = createContext<AlertsSeen | null>(null);

function cookieSeen(): string | null {
  return parseSeen(readSeenCookie(document.cookie));
}

export function AlertsSeenProvider({
  initial,
  children,
}: {
  initial: string | null;
  children: ReactNode;
}) {
  const [seenAt, setSeenAt] = useState(initial);
  const latest = useRef(seenAt);

  const markSeen = useCallback((instant: string) => {
    const shown = parseSeen(instant);
    if (shown === null) return;
    const current = latest.current;
    const known = cookieSeen();
    const stored = known === null ? current : laterOf(current, known);
    const next = laterOf(stored, shown);
    if (next === current) return;
    latest.current = next;
    setSeenAt(next);
    if (next === known) return;
    document.cookie = seenCookie(next);
  }, []);

  const value = useMemo(() => ({ seenAt, markSeen }), [seenAt, markSeen]);

  return <AlertsSeenContext value={value}>{children}</AlertsSeenContext>;
}

export function useAlertsSeen(): AlertsSeen {
  const context = useContext(AlertsSeenContext);
  if (context === null) {
    throw new Error("Alerts need an AlertsSeenProvider above them");
  }
  return context;
}
