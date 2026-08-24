import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="page-gutter flex items-center justify-between py-4 sm:[--gutter:1.5rem]">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md text-title focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Image
            src="/brand/mark.png"
            alt=""
            width={24}
            height={24}
            priority
            className="rounded-[6px]"
          />
          <span translate="no">asobeast</span>
        </Link>
        <ThemeToggle />
      </header>
      <main
        id="main-content"
        tabIndex={-1}
        className="page-gutter flex flex-1 items-center justify-center py-6 outline-none sm:[--gutter:1.5rem]"
      >
        {children}
      </main>
    </div>
  );
}
