import type { ReviewReply } from '@prisma/client';
import { toReviewReplyItem } from './review-reply.mapper';

const UPDATED = new Date('2026-10-20T08:00:00.000Z');
const POSTED = new Date('2026-10-20T09:00:00.000Z');

const ROW: ReviewReply = {
  reviewId: 'rev-1',
  appId: 'app-1',
  workspaceId: 'ws_1',
  text: 'Thanks, fixed in 3.5',
  tone: 'friendly',
  model: 'gpt-test',
  generatedAt: UPDATED,
  repliedAt: null,
  postedAt: null,
  postedText: null,
  postState: null,
  storeReviewId: null,
  storeResponseId: null,
  postedByUserId: null,
  createdAt: UPDATED,
  updatedAt: UPDATED,
};

describe('toReviewReplyItem', () => {
  it('maps the post block with the poster email and null without a post', () => {
    expect(toReviewReplyItem(ROW).post).toBeNull();
    expect(
      toReviewReplyItem({
        ...ROW,
        repliedAt: POSTED,
        postedAt: POSTED,
        postedText: 'Thanks',
        postState: 'published',
        storeResponseId: 'response-1',
        postedByUserId: 'user-1',
        postedBy: { email: 'owner@example.com' },
      }),
    ).toMatchObject({
      repliedAt: POSTED.toISOString(),
      post: {
        postedAt: POSTED.toISOString(),
        postedText: 'Thanks',
        state: 'published',
        storeResponseId: 'response-1',
        postedBy: 'owner@example.com',
      },
    });
  });

  it('reads an unknown post state as pending and a removed poster as null', () => {
    expect(
      toReviewReplyItem({
        ...ROW,
        postedAt: POSTED,
        postedText: 'Thanks',
        postState: 'odd',
        postedBy: null,
      }).post,
    ).toMatchObject({ state: 'pending', postedBy: null });
  });
});
