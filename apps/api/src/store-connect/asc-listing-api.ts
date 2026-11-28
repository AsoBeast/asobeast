import { type AscRequester, createdResource } from './asc-requester';
import { ASC_PAGE_SIZE } from './asc-analytics-api';

export interface AscAppVersionLocalization {
  locale: string;
  keywords: string;
  promotionalText: string | null;
  description: string | null;
}

export interface AscLiveVersion {
  id: string;
  version: string | null;
}

export type AscNominationState = 'DRAFT' | 'SUBMITTED';

export interface AscNomination {
  id: string;
  state: string;
  submittedDate: string | null;
  publishStartDate: string | null;
  publishEndDate: string | null;
}

const READY_FOR_SALE = 'READY_FOR_SALE';

const releasedOn = ({
  attributes,
}: {
  attributes?: { createdDate?: string };
}): number => Date.parse(attributes?.createdDate ?? '') || 0;

export class AscListingApi {
  constructor(private readonly requester: AscRequester) {}

  async liveVersion(appId: string): Promise<AscLiveVersion | null> {
    const versions = await this.requester.page<{
      versionString?: string;
      createdDate?: string;
    }>(
      `/v1/apps/${encodeURIComponent(appId)}/appStoreVersions?filter[appStoreState]=${READY_FOR_SALE}&filter[platform]=IOS&fields[appStoreVersions]=versionString,createdDate&limit=${ASC_PAGE_SIZE}`,
    );
    const withVersion = versions.filter(
      ({ attributes }) => typeof attributes?.versionString === 'string',
    );
    const newest = withVersion.sort(
      (left, right) => releasedOn(right) - releasedOn(left),
    );
    const live = newest[0];
    return live
      ? { id: live.id, version: live.attributes?.versionString ?? null }
      : null;
  }

  async versionLocalizations(
    versionId: string,
  ): Promise<AscAppVersionLocalization[]> {
    const resources = await this.requester.page<{
      locale?: string;
      keywords?: string;
      promotionalText?: string;
      description?: string;
    }>(
      `/v1/appStoreVersions/${encodeURIComponent(versionId)}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,keywords,promotionalText,description&limit=${ASC_PAGE_SIZE}`,
    );
    return resources.flatMap(({ attributes }) =>
      attributes?.locale
        ? [
            {
              locale: attributes.locale,
              keywords: attributes.keywords ?? '',
              promotionalText: attributes.promotionalText ?? null,
              description: attributes.description ?? null,
            },
          ]
        : [],
    );
  }

  async primaryLocale(appId: string): Promise<string | null> {
    const response = await this.requester.send({
      method: 'GET',
      path: `/v1/apps/${encodeURIComponent(appId)}?fields[apps]=primaryLocale`,
    });
    const { attributes } = createdResource<{ primaryLocale?: unknown }>(
      response,
    );
    return typeof attributes?.primaryLocale === 'string'
      ? attributes.primaryLocale
      : null;
  }

  async nominations(
    appId: string,
    states: readonly AscNominationState[],
  ): Promise<AscNomination[]> {
    const resources = await this.requester.page<{
      state?: string;
      submittedDate?: string;
      publishStartDate?: string;
      publishEndDate?: string;
    }>(
      `/v1/nominations?filter[state]=${states.join(',')}&filter[relatedApps]=${encodeURIComponent(appId)}&fields[nominations]=state,submittedDate,publishStartDate,publishEndDate&limit=${ASC_PAGE_SIZE}`,
    );
    return resources.map(({ id, attributes }) => ({
      id,
      state: attributes?.state ?? '',
      submittedDate: attributes?.submittedDate ?? null,
      publishStartDate: attributes?.publishStartDate ?? null,
      publishEndDate: attributes?.publishEndDate ?? null,
    }));
  }
}
