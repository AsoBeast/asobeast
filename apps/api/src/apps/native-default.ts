import {
  type AppStoreLocalization,
  declaredLanguage,
  localizationLanguage,
  nativeLocalizations,
} from '@asobeast/shared';
import {
  knowsLanguage,
  languageEvidence,
  type LanguageEvidence,
} from '../common/text-language';

export const NATIVE_MIN_HITS = 6;
export const NATIVE_OVER_ENGLISH = 2;
export const UNLISTED_MIN_TOKENS = 50;
export const UNLISTED_MAX_ENGLISH_SHARE = 0.05;

export interface LocalizationProbe {
  localization: AppStoreLocalization;
  echoed: boolean;
}

export interface NativeDefaultProof {
  home: string;
  description: string;
  probes: readonly LocalizationProbe[];
  declared: readonly string[];
}

const languageOf = (tag: AppStoreLocalization): string =>
  declaredLanguage(localizationLanguage(tag));

const englishHits = (evidence: LanguageEvidence): number =>
  evidence.hits.en ?? 0;

function bestWordLanguage(evidence: LanguageEvidence): string | null {
  const [first, second] = Object.entries(evidence.hits).sort(
    (a, b) => b[1] - a[1],
  );
  if (!first || first[1] < NATIVE_MIN_HITS) return null;
  if (second && second[1] === first[1]) return null;
  return first[1] >= NATIVE_OVER_ENGLISH * englishHits(evidence)
    ? first[0]
    : null;
}

function listedNative(
  candidates: readonly AppStoreLocalization[],
  evidence: LanguageEvidence,
): AppStoreLocalization | null {
  const language = evidence.script ?? bestWordLanguage(evidence);
  const winners = candidates.filter((tag) => languageOf(tag) === language);
  return winners.length === 1 ? winners[0] : null;
}

function unlistedNative(
  natives: readonly AppStoreLocalization[],
  candidates: readonly AppStoreLocalization[],
  declared: ReadonlySet<string>,
  evidence: LanguageEvidence,
): AppStoreLocalization | null {
  if (natives.length !== 1 || candidates.length !== 1) return null;
  if (evidence.script !== null) return null;
  const [native] = candidates;
  const language = languageOf(native);
  if (knowsLanguage(language)) return null;
  if (declared.size !== 1 || !declared.has(language)) return null;
  if (evidence.tokens < UNLISTED_MIN_TOKENS) return null;
  return evidence.englishOnly / evidence.tokens < UNLISTED_MAX_ENGLISH_SHARE
    ? native
    : null;
}

export function provenNativeDefault({
  home,
  description,
  probes,
  declared,
}: NativeDefaultProof): AppStoreLocalization | null {
  const natives = nativeLocalizations(home);
  const languages = new Set(declared.map(declaredLanguage));
  const candidates = natives.filter(
    (tag) =>
      probes.some((probe) => probe.localization === tag && probe.echoed) &&
      (languages.size === 0 || languages.has(languageOf(tag))),
  );
  if (candidates.length === 0) return null;
  const evidence = languageEvidence(description);
  if (evidence.tokens === 0) return null;
  return (
    listedNative(candidates, evidence) ??
    unlistedNative(natives, candidates, languages, evidence)
  );
}
