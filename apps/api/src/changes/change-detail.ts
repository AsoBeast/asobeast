import { z } from 'zod';
import type { ChangeDetail } from '@asobeast/shared';

const reference = z.object({ position: z.number().int(), url: z.string() });

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
]);

export function readChangeDetail(value: unknown): ChangeDetail | null {
  const parsed = detailSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
