import { AppStoreLocalization } from '@asobeast/shared';

const LOOKUP_EXCEPTIONS: Partial<Record<AppStoreLocalization, string>> = {
  no: 'nb',
  'zh-Hans': 'zh_cn',
};

const PAGE_EXCEPTIONS: Partial<Record<AppStoreLocalization, string>> = {
  no: 'nb',
};

export const lookupLanguage = (localization: AppStoreLocalization): string =>
  LOOKUP_EXCEPTIONS[localization] ?? localization;

export const pageLanguage = (localization: AppStoreLocalization): string =>
  PAGE_EXCEPTIONS[localization] ?? localization;
