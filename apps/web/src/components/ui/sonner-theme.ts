import type { ToasterProps } from "sonner";

type ToasterTheme = NonNullable<ToasterProps["theme"]>;

export function resolveToasterTheme(theme: string | undefined): ToasterTheme {
  if (theme === "light" || theme === "dark" || theme === "system") {
    return theme;
  }
  return "system";
}
