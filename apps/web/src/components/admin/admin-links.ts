import { FileJson, ListChecks, ShieldCheck } from "lucide-react";
import { ADMIN_ROOT } from "@/lib/admin-sections";

export const ADMIN_ENTRY = {
  href: ADMIN_ROOT,
  label: "Admin",
  icon: ShieldCheck,
} as const;

export const ADMIN_TOOLS = [
  { href: "/admin/queues", label: "Queue dashboard", Icon: ListChecks },
  { href: "/docs", label: "API docs", Icon: FileJson },
] as const;
