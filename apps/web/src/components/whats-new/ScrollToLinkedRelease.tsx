"use client";

import { useEffect } from "react";

export function ScrollToLinkedRelease() {
  useEffect(() => {
    const linked = window.location.hash.slice(1);
    if (!linked || window.scrollY > 0) return;
    document.getElementById(linked)?.scrollIntoView();
  }, []);

  return null;
}
