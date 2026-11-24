import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { PRODUCT_NAME } from "@/lib/brand";

export function SignedOutHeader({ children }: { children: ReactNode }) {
  return (
    <header className="page-gutter flex items-center justify-between gap-4 py-4 sm:[--gutter:1.5rem]">
      <Link
        href="/"
        className="flex items-center gap-2 rounded-md text-heading focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Image
          src="/brand/mark.png"
          alt=""
          width={24}
          height={24}
          priority
          className="rounded-[6px]"
        />
        <span translate="no">{PRODUCT_NAME}</span>
      </Link>
      {children}
    </header>
  );
}

export function SignedOutPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <SignedOutHeader>
        <div className="flex items-center gap-1">
          <LanguageSwitcher className="border-0 bg-transparent" />
          <ThemeToggle />
        </div>
      </SignedOutHeader>
      <main
        id="main-content"
        tabIndex={-1}
        className="page-gutter flex flex-1 items-center justify-center pt-6 pb-12 outline-none sm:pb-24 sm:[--gutter:1.5rem]"
      >
        {children}
      </main>
    </div>
  );
}
