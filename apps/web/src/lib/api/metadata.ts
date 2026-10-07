import type {
  MetadataAssistantRequest,
  MetadataAssistantResult,
  MetadataAssistantStatus,
  MetadataAuditResult,
} from "@asobeast/shared";
import { apiFetch, marketParams, withQuery } from "./client";

export function getMetadataAudit(
  appId: string,
  country?: string,
): Promise<MetadataAuditResult> {
  return apiFetch<MetadataAuditResult>(
    withQuery(`/apps/${appId}/metadata/audit`, marketParams(country)),
  );
}

export function getMetadataAssistantStatus(): Promise<MetadataAssistantStatus> {
  return apiFetch<MetadataAssistantStatus>("/metadata/assistant");
}

export function generateMetadataDrafts(
  appId: string,
  body: MetadataAssistantRequest,
): Promise<MetadataAssistantResult> {
  return apiFetch<MetadataAssistantResult>(
    `/apps/${appId}/metadata/assistant`,
    { method: "POST", body: JSON.stringify(body) },
  );
}
