import { describe, expect, it } from "vitest";
import { channelHint, webhookRowLabel } from "./webhook-channel-copy";

describe("channelHint", () => {
  it.each([
    [
      "https://discord.com/api/webhooks/1/x",
      "Recognised as Discord. Reports arrive as embeds with the app icon.",
    ],
    [
      "https://hooks.slack.com/services/T1/B2/x",
      "Recognised as Slack. Reports arrive as Block Kit messages.",
    ],
    [
      "https://hooks.slack.com/workflows/T1/A2/3/x",
      "Recognised as a Slack workflow trigger. It receives the JSON payload; map its fields in Workflow Builder.",
    ],
    [
      "https://prod-21.westeurope.logic.azure.com/workflows/a/triggers/manual/paths/invoke?sig=x",
      "Recognised as Microsoft Teams. Reports arrive as an Adaptive Card; Teams confirms acceptance, not delivery.",
    ],
    [
      "https://contoso.webhook.office.com/webhookb2/abc",
      'Office 365 connector urls stopped delivering in May 2026. Create a workflow with the "Send webhook alerts to a channel" template and paste its url.',
    ],
    [
      "https://api.telegram.org/bot1:A/sendMessage",
      "Recognised as Telegram. Add ?chat_id=<id> after sendMessage.",
    ],
    [
      "https://api.telegram.org/bot1:A/sendMessage?chat_id=-100",
      "Recognised as Telegram. Reports arrive as a message from your bot.",
    ],
    [
      "https://chat.googleapis.com/v1/spaces/S/messages?key=k&token=t",
      "Recognised as Google Chat. Reports arrive as a card.",
    ],
    [
      "https://n8n.example.com/webhook-test/asobeast",
      "This is an n8n test url. It works only while the editor listens; use the production url.",
    ],
    [
      "https://hooks.zapier.com/hooks/catch/1/2/",
      "Recognised as a JSON webhook. It receives the documented payload.",
    ],
  ])("describes %s", (url, hint) => {
    expect(channelHint(url)).toBe(hint);
  });

  it("says nothing until the text is an http url", () => {
    expect(channelHint("")).toBeNull();
    expect(channelHint("https://")).toBeNull();
    expect(channelHint("ftp://files.example.com/x")).toBeNull();
  });
});

describe("webhookRowLabel", () => {
  it("hides the token of a chat tool and keeps a json endpoint whole", () => {
    expect(
      webhookRowLabel(
        "https://api.telegram.org/bot1:SECRET/sendMessage?chat_id=-1",
        "telegram",
      ),
    ).toBe("api.telegram.org/bot…/sendMessage");
    expect(
      webhookRowLabel("https://hooks.slack.com/services/T1/B2/x", "slack"),
    ).toBe("hooks.slack.com/services/…");
    expect(
      webhookRowLabel("https://hooks.example.com/asobeast", "generic"),
    ).toBe("https://hooks.example.com/asobeast");
  });
});
