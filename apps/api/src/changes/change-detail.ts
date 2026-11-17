import { z } from 'zod';
import { isoDateOrNull, type ChangeDetail } from '@asobeast/shared';

const reference = z.object({ position: z.number().int(), url: z.string() });

const nullableText = z.string().nullable();

const nullableDate = z.preprocess(isoDateOrNull, nullableText);

const appEventRef = z.object({
  appEventId: z.string(),
  title: nullableText,
  kind: nullableText,
  badge: nullableText,
  startsAt: nullableDate,
  endsAt: nullableDate,
});

const storyRef = z.object({
  storyId: z.string(),
  heading: nullableText,
  title: nullableText,
});

const detailSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('images'),
    before: z.array(reference),
    after: z.array(reference),
    added: z.array(z.number().int()),
    removed: z.array(z.number().int()),
    reordered: z.boolean(),
  }),
  z.object({
    kind: z.literal('captions'),
    added: z.array(z.string()),
    removed: z.array(z.string()),
  }),
  z.object({
    kind: z.literal('events'),
    added: z.array(appEventRef),
    removed: z.array(appEventRef),
  }),
  z.object({
    kind: z.literal('featuring'),
    added: z.array(storyRef),
    removed: z.array(storyRef),
  }),
  z.object({
    kind: z.literal('editorsChoice'),
    showsBadge: z.boolean(),
    notes: nullableText,
  }),
]);

export function readChangeDetail(value: unknown): ChangeDetail | null {
  const parsed = detailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
