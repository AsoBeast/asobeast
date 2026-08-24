import { notFound } from "next/navigation";
import { KeywordFieldSuggestionCard } from "@/components/KeywordFieldSuggestionCard";
import { CoverageTable } from "@/components/metadata/CoverageTable";
import { MetadataAssistantPanel } from "@/components/metadata/MetadataAssistantPanel";
import { MetadataFieldCard } from "@/components/MetadataFieldCard";
import {
  ApiError,
  getMetadataAssistantStatus,
  getMetadataAudit,
} from "@/lib/api";

export default async function MetadataPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getMetadataAudit(id).catch((err) => {
    if (err instanceof ApiError && err.envelope.statusCode === 404) notFound();
    return null;
  });
  if (!result) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        Metadata audit is not available for this app yet.
      </div>
    );
  }
  const assistant = await getMetadataAssistantStatus().catch(() => null);

  return (
    <div className="page-wide flex flex-col gap-8">
      <section className="grid gap-4 md:grid-cols-2">
        {result.fields.map((field) => (
          <MetadataFieldCard
            key={field.field}
            field={field.field}
            value={field.value ?? ""}
            limit={field.limit}
            issues={field.issues}
          />
        ))}
      </section>

      {assistant?.configured ? (
        <MetadataAssistantPanel appId={id} store={result.store} />
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Keyword coverage</h2>
        {result.coverage.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Track keywords to see how your metadata covers them.
          </div>
        ) : (
          <CoverageTable rows={result.coverage} />
        )}
      </section>

      {result.store === "APP_STORE" &&
      result.keywordFieldSuggestion !== null ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Suggestion</h2>
          <KeywordFieldSuggestionCard
            suggestion={result.keywordFieldSuggestion}
          />
        </section>
      ) : null}
    </div>
  );
}
