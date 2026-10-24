import type {
  AppAnnotationCreateRequest,
  AppAnnotationItem,
  AppAnnotationList,
} from "@asobeast/shared";
import { apiFetch } from "./client";

export function getAnnotations(appId: string): Promise<AppAnnotationList> {
  return apiFetch<AppAnnotationList>(`/apps/${appId}/annotations`);
}

export function addAnnotation(
  appId: string,
  request: AppAnnotationCreateRequest,
): Promise<AppAnnotationItem> {
  return apiFetch<AppAnnotationItem>(`/apps/${appId}/annotations`, {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function deleteAnnotation(
  appId: string,
  annotationId: string,
): Promise<void> {
  return apiFetch<void>(`/apps/${appId}/annotations/${annotationId}`, {
    method: "DELETE",
  });
}
