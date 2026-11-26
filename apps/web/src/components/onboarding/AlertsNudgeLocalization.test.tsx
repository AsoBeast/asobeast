import { NextIntlClientProvider } from "next-intl";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FirstRunStatus } from "@asobeast/shared";
import { catalogs } from "@/i18n/messages";
import zhSetup from "../../../messages/zh-CN/setup.json";
import { AlertsNudge } from "./AlertsNudge";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useSyncExternalStore: () => false };
});

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: (options: { queryKey: readonly unknown[] }) => {
      const key = options.queryKey;
      if (key.at(-1) === "first-run") {
        return {
          data: {
            appId: "app-1",
            complete: false,
            stages: [
              {
                stage: "rankings",
                ready: 2,
                total: 2,
                complete: true,
                expectedBy: null,
              },
              {
                stage: "history",
                ready: 2,
                total: 7,
                complete: false,
                expectedBy: null,
              },
            ],
          } satisfies FirstRunStatus,
        };
      }
      if (key[0] === "webhooks" || key[0] === "email-alerts")
        return { data: [] };
      if (key[0] === "alerts" && key[1] === "config") {
        return { data: { emailEnabled: false } };
      }
      return { data: undefined };
    },
  };
});

vi.mock("@/components/settings/AddWebhookDialog", () => ({
  AddWebhookDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

vi.mock("@/components/settings/AddEmailAlertDialog", () => ({
  AddEmailAlertDialog: ({ trigger }: { trigger: React.ReactNode }) => trigger,
}));

const messages = {
  ...catalogs["zh-CN"],
  setup: {
    ...zhSetup,
    alertsNudge: {
      ...zhSetup.alertsNudge,
      smtpLink: "<link>设置邮件投递</link>，因为此实例需要 SMTP",
    },
  },
};

describe("AlertsNudge rich SMTP guidance", () => {
  it("lets the catalog place the link before the sentence", () => {
    const markup = renderToStaticMarkup(
      <NextIntlClientProvider locale="zh-CN" timeZone="UTC" messages={messages}>
        <AlertsNudge id="app-1" />
      </NextIntlClientProvider>,
    );

    expect(markup).toContain(">设置邮件投递</a>，因为此实例需要 SMTP");
    expect(markup).not.toContain("此实例需要配置 SMTP 才能发送邮件提醒。");
  });
});
