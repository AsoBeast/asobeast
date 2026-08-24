import type {
  AlertDeliveryItem,
  AlertDeliveryStatus,
  AlertFlushResult,
  AlertsConfig,
  EmailAlertCreateRequest,
  EmailAlertItem,
  EmailAlertUpdateRequest,
  WebhookCreateRequest,
  WebhookItem,
  WebhookTestResult,
  WebhookUpdateRequest,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getWebhooks(): Promise<WebhookItem[]> {
  return apiFetch<WebhookItem[]>("/webhooks");
}

export function createWebhook(
  body: WebhookCreateRequest,
): Promise<WebhookItem> {
  return apiFetch<WebhookItem>("/webhooks", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWebhook(
  id: string,
  body: WebhookUpdateRequest,
): Promise<WebhookItem> {
  return apiFetch<WebhookItem>(`/webhooks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteWebhook(id: string): Promise<void> {
  return apiFetch<void>(`/webhooks/${id}`, { method: "DELETE" });
}

export function testWebhook(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`/webhooks/${id}/test`, {
    method: "POST",
  });
}

export function getAlertsConfig(): Promise<AlertsConfig> {
  return apiFetch<AlertsConfig>("/alerts/config");
}

export function getAlertDeliveryStatus(): Promise<AlertDeliveryStatus> {
  return apiFetch<AlertDeliveryStatus>("/alerts/delivery");
}

export function flushAlerts(): Promise<AlertFlushResult> {
  return apiFetch<AlertFlushResult>("/alerts/flush", { method: "POST" });
}

export function getEmailAlerts(): Promise<EmailAlertItem[]> {
  return apiFetch<EmailAlertItem[]>("/email-alerts");
}

export function createEmailAlert(
  body: EmailAlertCreateRequest,
): Promise<EmailAlertItem> {
  return apiFetch<EmailAlertItem>("/email-alerts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateEmailAlert(
  id: string,
  body: EmailAlertUpdateRequest,
): Promise<EmailAlertItem> {
  return apiFetch<EmailAlertItem>(`/email-alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteEmailAlert(id: string): Promise<void> {
  return apiFetch<void>(`/email-alerts/${id}`, { method: "DELETE" });
}

export function testEmailAlert(id: string): Promise<WebhookTestResult> {
  return apiFetch<WebhookTestResult>(`/email-alerts/${id}/test`, {
    method: "POST",
  });
}

export function getDeliveries(
  filter: { webhookId: string } | { emailAlertId: string },
): Promise<AlertDeliveryItem[]> {
  const params = new URLSearchParams(filter);
  return apiFetch<AlertDeliveryItem[]>(`/alerts/deliveries?${params}`);
}
