export interface AppAnnotationItem {
  id: string;
  appId: string;
  date: string;
  label: string;
  market: string | null;
  tag: string | null;
  createdAt: string;
}

export interface AppAnnotationList {
  annotations: AppAnnotationItem[];
}

export interface AppAnnotationCreateRequest {
  date: string;
  label: string;
  market?: string;
  tag?: string;
}
