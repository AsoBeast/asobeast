import type { AscRequester } from './asc-requester';
import { ASC_PAGE_SIZE } from './asc-analytics-api';

export interface AscAppVersionLocalization {
  locale: string;
  keywords: string;
}

export interface AscLiveVersion {
  id: string;
  version: string | null;
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
    }>(
      `/v1/appStoreVersions/${encodeURIComponent(versionId)}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale,keywords&limit=${ASC_PAGE_SIZE}`,
    );
    return resources.flatMap(({ attributes }) =>
      attributes?.locale
        ? [
            {
              locale: attributes.locale,
              keywords: attributes.keywords ?? '',
            },
          ]
        : [],
    );
  }
}
