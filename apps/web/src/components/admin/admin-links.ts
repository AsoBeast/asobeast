import { FileJson, ListChecks, ShieldCheck } from "lucide-react";
import { ADMIN_ROOT } from "@/lib/admin-sections";

export const ADMIN_ENTRY = {
  href: ADMIN_ROOT,
  labelKey: "title",
  icon: ShieldCheck,
} as const;

export const ADMIN_TOOLS = [
  {
    href: "/admin/queues",
    labelKey: "nav.queueDashboard",
    Icon: ListChecks,
  },
  { href: "/docs", labelKey: "nav.apiDocs", Icon: FileJson },
] as const;
