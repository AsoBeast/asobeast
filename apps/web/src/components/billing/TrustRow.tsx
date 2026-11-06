import { CheckMark } from "./CheckMark";

export function TrustRow({ lines }: { lines: readonly string[] }) {
  return (
    <ul
      aria-label="Why the trial is safe"
      className="grid gap-3 text-heading sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3"
    >
      {lines.map((line) => (
        <li key={line} className="flex items-center gap-2">
          <CheckMark className="size-5" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}
