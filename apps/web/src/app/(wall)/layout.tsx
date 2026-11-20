import type { ReactNode } from "react";
import { SignedOutHeader } from "@/components/auth/SignedOutHeader";
import { WallHeader } from "@/components/auth/WallHeader";

export default function WallLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <div className="flex min-h-svh flex-col">
      <SignedOutHeader>
        <WallHeader />
      </SignedOutHeader>
      <main
        id="main-content"
        tabIndex={-1}
        className="page-gutter flex flex-1 flex-col py-6 outline-none sm:[--gutter:1.5rem]"
      >
        {children}
      </main>
    </div>
  );
}
