export interface WebHealth {
  status: string;
  statusPageUrl: string | null;
  errorReportingDsn: string | null;
}

export async function getWebHealth(): Promise<WebHealth> {
  const response = await fetch("/api/health", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`The web app answered ${response.status} for its health`);
  }
  return (await response.json()) as WebHealth;
}
