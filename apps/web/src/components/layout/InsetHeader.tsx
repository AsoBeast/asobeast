import { UserMenu } from "@/components/auth/UserMenu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { HealthBadge } from "./HealthBadge";
import { PageActions } from "./PageActions";
import { ThemeToggle } from "./ThemeToggle";

export function InsetHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center gap-2 page-gutter border-b border-border bg-card [--gutter:0.75rem] sm:[--gutter:1rem] print:hidden">
      <SidebarTrigger />
      <Separator orientation="vertical" className="!h-4 !self-center" />
      <Breadcrumbs />
      <div className="flex shrink-0 items-center gap-1">
        <PageActions />
        <CommandPalette />
        <HealthBadge />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
