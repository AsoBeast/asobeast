import { AscError } from './asc-errors';
import type { AscRequester, Resource } from './asc-requester';

export const ASC_REVIEW_FIELDS =
  'rating,title,body,reviewerNickname,createdDate,territory';
const REVIEW_PAGE_SIZE = 200;
const MISSING = 404;

export interface AscCustomerReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  reviewerNickname: string | null;
  createdDate: string;
  territory: string;
}

export type AscResponseState = 'PENDING_PUBLISH' | 'PUBLISHED';

export interface AscReviewResponse {
  id: string;
  state: AscResponseState;
  lastModifiedDate: string;
}

export interface ReviewListQuery {
  territory: string | null;
  rating?: number;
  until: string | null;
  maxPages: number;
}

type ReviewAttributes = Partial<Omit<AscCustomerReview, 'id'>>;
type ResponseAttributes = Partial<Omit<AscReviewResponse, 'id'>>;

const toCustomerReview = ({
  id,
  attributes,
}: Resource<ReviewAttributes>): AscCustomerReview => ({
  id,
  rating: attributes?.rating ?? 0,
  title: attributes?.title ?? null,
  body: attributes?.body ?? '',
  reviewerNickname: attributes?.reviewerNickname ?? null,
  createdDate: attributes?.createdDate ?? '',
  territory: attributes?.territory ?? '',
});

const listPath = (
  appId: string,
  { territory, rating }: ReviewListQuery,
): string =>
  [
    `/v1/apps/${encodeURIComponent(appId)}/customerReviews?`,
    territory === null
      ? ''
      : `filter[territory]=${encodeURIComponent(territory)}&`,
    rating === undefined ? '' : `filter[rating]=${rating}&`,
    `sort=-createdDate&limit=${REVIEW_PAGE_SIZE}&fields[customerReviews]=${ASC_REVIEW_FIELDS}`,
  ].join('');

const olderThan = (
  review: AscCustomerReview | undefined,
  until: string | null,
): boolean =>
  until !== null &&
  review !== undefined &&
  Date.parse(review.createdDate) < Date.parse(until);

export class AscReviewsApi {
  constructor(private readonly requester: AscRequester) {}

  async customerReviews(
    appId: string,
    query: ReviewListQuery,
  ): Promise<AscCustomerReview[]> {
    const reviews: AscCustomerReview[] = [];
    let pages = 0;
    for await (const page of this.requester.pages<ReviewAttributes>(
      listPath(appId, query),
    )) {
      reviews.push(...page.map(toCustomerReview));
      pages += 1;
      if (pages >= query.maxPages || olderThan(reviews.at(-1), query.until)) {
        break;
      }
    }
    return reviews;
  }

  async respond(reviewId: string, text: string): Promise<AscReviewResponse> {
    const response = await this.requester.send(
      {
        method: 'POST',
        path: '/v1/customerReviewResponses',
        body: {
          data: {
            type: 'customerReviewResponses',
            attributes: { responseBody: text },
            relationships: {
              review: { data: { type: 'customerReviews', id: reviewId } },
            },
          },
        },
      },
      false,
    );
    const created = (
      response.body as { data?: Resource<ResponseAttributes> } | null
    )?.data;
    if (!created) {
      throw new AscError('App Store Connect created no response', 502, null);
    }
    return {
      id: created.id,
      state: created.attributes?.state ?? 'PENDING_PUBLISH',
      lastModifiedDate: created.attributes?.lastModifiedDate ?? '',
    };
  }

  async deleteResponse(responseId: string): Promise<void> {
    try {
      await this.requester.send(
        {
          method: 'DELETE',
          path: `/v1/customerReviewResponses/${encodeURIComponent(responseId)}`,
        },
        false,
      );
    } catch (error) {
      if (!(error instanceof AscError && error.status === MISSING)) throw error;
    }
  }
}
