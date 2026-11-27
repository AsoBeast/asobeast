import { useTranslations } from "next-intl";
import { CheckMark } from "./CheckMark";

export function TrustRow({ lines }: { lines: readonly string[] }) {
  const t = useTranslations("billing");

  return (
    <ul
      aria-label={t("trial.trustLabel")}
      className="grid gap-3 text-body font-medium sm:flex sm:flex-wrap sm:gap-x-8 sm:gap-y-3"
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
