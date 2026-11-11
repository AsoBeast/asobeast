"use client";

import { useAuth } from "@/components/auth/use-auth";
import { LegalLinks } from "./LegalLinks";

export function SidebarLegalLinks() {
  const { status } = useAuth();
  return status?.billing ? <LegalLinks /> : null;
}
