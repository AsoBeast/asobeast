import type { ReactNode } from "react";
import { SignedOutPage } from "@/components/auth/SignedOutHeader";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <SignedOutPage>{children}</SignedOutPage>;
}
