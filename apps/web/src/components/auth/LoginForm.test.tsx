import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { loadMessages } from "@/i18n/messages";
import type { Locale } from "@/lib/locale";
import { LoginForm } from "./LoginForm";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("./use-auth", () => ({
  useAuth: () => ({ status: { registrationOpen: false } }),
}));

async function markup(locale: Locale) {
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      timeZone="UTC"
      messages={await loadMessages(locale)}
    >
      <QueryClientProvider client={queryClient}>
        <LoginForm />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe("LoginForm", () => {
  it("renders the sign-in form in the selected locale", async () => {
    const english = await markup("en");
    const chinese = await markup("zh-CN");

    expect(english).toContain("Sign in");
    expect(english).toContain("Email");
    expect(english).toContain("Password");
    expect(chinese).toContain("登录");
    expect(chinese).toContain("邮箱");
    expect(chinese).toContain("密码");
    expect(chinese).toContain("忘记密码？");
    expect(chinese).toContain('aria-label="显示密码"');
    expect(chinese).not.toContain("Sign in");
  });
});
