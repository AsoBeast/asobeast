import { z } from 'zod';
import type { AppStoreReviewResult } from './app-store.lib';

const labelled = z.object({ label: z.string() });

const rating = z.object({ label: z.coerce.number().int().min(1).max(5) });

const reviewEntry = z.object({
  id: labelled,
  author: z.object({ name: labelled }).optional(),
  'im:version': labelled.optional(),
  'im:rating': rating.optional().catch(undefined),
  title: labelled.optional(),
  content: labelled.optional(),
  updated: labelled.optional(),
});

type ReviewEntry = z.infer<typeof reviewEntry>;

const reviewsFeed = z.object({
  feed: z.object({
    entry: z.union([z.array(reviewEntry), reviewEntry]).optional(),
  }),
});

export function reviewsFeedUrl(
  id: number,
  country: string,
  page: number,
  nonce: string,
): string {
  return `https://itunes.apple.com/${country}/rss/customerreviews/page=${page}/id=${id}/sortby=mostrecent/json?nonce=${nonce}`;
}

export function parseReviewsFeed(body: unknown): AppStoreReviewResult[] {
  const parsed = reviewsFeed.safeParse(body);
  if (!parsed.success) {
    throw new Error('unexpected reviews feed shape');
  }
  const { entry = [] } = parsed.data.feed;
  return (Array.isArray(entry) ? entry : [entry]).flatMap(toReview);
}

function toReview(entry: ReviewEntry): AppStoreReviewResult[] {
  const score = entry['im:rating']?.label;
  if (score === undefined) return [];
  return [
    {
      id: entry.id.label,
      userName: entry.author?.name.label,
      version: entry['im:version']?.label,
      score,
      title: entry.title?.label,
      text: entry.content?.label ?? '',
      updated: entry.updated?.label,
    },
  ];
}
