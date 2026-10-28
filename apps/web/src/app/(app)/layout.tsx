import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { InsetHeader } from "@/components/layout/InsetHeader";
import { SystemBanner } from "@/components/layout/SystemBanner";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { entryDestination, REQUESTED_PATH_HEADER } from "@/lib/auth-routes";
import { checkoutReturned, searchOf } from "@/lib/checkout-return";
import {
  SIDEBAR_COOKIE_NAME,
  sidebarOpenFromCookie,
} from "@/lib/sidebar-cookie";
import { viewer } from "@/lib/viewer";

export default async function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  const sidebarOpen = sidebarOpenFromCookie(
    cookieStore.get(SIDEBAR_COOKIE_NAME)?.value,
  );
  const requested = (await headers()).get(REQUESTED_PATH_HEADER);
  const user = await viewer();
  if (user?.entryStep && !checkoutReturned(searchOf(requested))) {
    redirect(entryDestination(user, null));
  }

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
            <SystemBanner />
            {children}
          </main>
        </AuthGate>
      </SidebarInset>
    </SidebarProvider>
  );
}
