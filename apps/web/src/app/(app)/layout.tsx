import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InsetHeader } from "@/components/layout/InsetHeader";
import { RunDelayBanner } from "@/components/layout/RunDelayBanner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  SIDEBAR_COOKIE_NAME,
  sidebarOpenFromCookie,
} from "@/lib/sidebar-cookie";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sidebarOpen = sidebarOpenFromCookie(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value,
  );

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
      <SidebarInset>
        <InsetHeader />
        <AuthGate>
          <main
            id="main-content"
            tabIndex={-1}
            className="page-gutter flex-1 py-6 outline-none sm:[--gutter:1.5rem]"
          >
            <RunDelayBanner />
            {children}
          </main>
        </AuthGate>
      </SidebarInset>
    </SidebarProvider>
  );
}
