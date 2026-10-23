"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const KEY_FIELDS = ["client_email", "private_key_id", "private_key"] as const;

export function isServiceAccountKey(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text);
    return (
      typeof parsed === "object" &&
      parsed !== null &&
      KEY_FIELDS.every(
        (field) =>
          typeof (parsed as Record<string, unknown>)[field] === "string",
      )
    );
  } catch {
    return false;
  }
}

export function PlayServiceAccountField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  async function choose(file: File | undefined) {
    if (!file) return;
    onChange(await file.text());
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="play-service-account">Service account key</Label>
      <Input
        id="play-service-account"
        type="password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Contents of the downloaded JSON key"
        autoComplete="off"
        spellCheck={false}
        data-1p-ignore="true"
        data-lpignore="true"
        data-bwignore="true"
      />
      <Label htmlFor="play-service-account-file" className="sr-only">
        Service account key file
      </Label>
      <Input
        id="play-service-account-file"
        type="file"
        accept="application/json,.json"
        className="max-w-xs"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <p className="text-xs text-muted-foreground">
        Choose the JSON key file or paste its contents. AsoBeast only reads the
        store performance files in the bucket.
      </p>
    </div>
  );
}
