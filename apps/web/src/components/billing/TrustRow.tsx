import { Check } from "lucide-react";

export function TrustRow({ lines }: { lines: readonly string[] }) {
  return (
    <ul
      aria-label="Why the trial is safe"
      className="grid gap-3 text-subtitle sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3"
    >
      {lines.map((line) => (
        <li key={line} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-success-subtle text-success"
          >
            <Check className="size-3" />
          </span>
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
