import { Check } from "lucide-react";

export function TrustRow({ lines }: { lines: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-x-8 gap-y-2 text-body">
      {lines.map((line) => (
        <li key={line} className="flex items-start gap-2">
          <Check
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-success"
          />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
