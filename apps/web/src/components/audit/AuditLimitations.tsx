import type { AuditLimitation } from "@asobeast/shared";

export function AuditLimitations({
  limitations,
}: {
  limitations: AuditLimitation[];
}) {
  if (limitations.length === 0) return null;

  return (
    <details className="rounded-xl border border-border px-4 py-3">
      <summary className="cursor-pointer text-body font-medium">
        What this audit cannot see
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {limitations.map((limitation) => (
          <li key={limitation.id} className="flex flex-col text-sm">
            <span className="font-medium">{limitation.label}</span>
            <span className="text-muted-foreground">{limitation.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
