import {
  type AppStoreLocalization,
  declaredLanguage,
  localizationLanguage,
  nativeLocalizations,
  readLocalizations,
} from '@asobeast/shared';
import {
  knowsLanguage,
  languageEvidence,
  type LanguageEvidence,
} from '../common/text-language';

export const DEFAULT_MIN_HITS = 6;
export const DEFAULT_OVER_PRIMARY = 2;
export const RIVAL_MAX_SCRIPT_SHARE = 0.05;
export const UNLISTED_MIN_TOKENS = 50;
export const UNLISTED_MAX_ENGLISH_SHARE = 0.05;

export interface LocalizationProbe {
  localization: AppStoreLocalization;
  echoed: boolean;
}

export interface HomeListingText {
  home: string;
  description: string;
  declared: readonly string[];
}

export interface HomeDefaultProof extends HomeListingText {
  probes: readonly LocalizationProbe[];
}

const languageOf = (tag: AppStoreLocalization): string =>
  declaredLanguage(localizationLanguage(tag));

const primaryLanguage = (home: string): string | null => {
  const [primary] = readLocalizations(home);
  return primary === undefined ? null : languageOf(primary);
};

export function homeDefaultCandidates(home: string): AppStoreLocalization[] {
  const own = primaryLanguage(home);
  return readLocalizations(home)
    .slice(1)
    .filter((tag) => languageOf(tag) !== own);
}

function bestWordLanguage(
  evidence: LanguageEvidence,
  rival: string,
): string | null {
  const [first, second] = Object.entries(evidence.hits).sort(
    (a, b) => b[1] - a[1],
  );
  if (!first || first[1] < DEFAULT_MIN_HITS) return null;
  if (second && second[1] === first[1]) return null;
  return first[1] >= DEFAULT_OVER_PRIMARY * (evidence.hits[rival] ?? 0)
    ? first[0]
    : null;
}

const beatsRivalScript = (evidence: LanguageEvidence, rival: string): boolean =>
  (evidence.scriptShares[rival] ?? 0) <= RIVAL_MAX_SCRIPT_SHARE;

const allowedBy =
  (declared: ReadonlySet<string>) =>
  (tag: AppStoreLocalization): boolean =>
    declared.size === 0 || declared.has(languageOf(tag));

export function suspectedHomeDefault({
  home,
  description,
  declared,
}: HomeListingText): AppStoreLocalization | null {
  const rival = primaryLanguage(home);
  if (rival === null) return null;
  const evidence = languageEvidence(description);
  if (evidence.tokens === 0 || !beatsRivalScript(evidence, rival)) return null;
  const language = evidence.script ?? bestWordLanguage(evidence, rival);
  const winners = homeDefaultCandidates(home)
    .filter(allowedBy(new Set(declared.map(declaredLanguage))))
    .filter((tag) => languageOf(tag) === language);
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
  if (evidence.words < UNLISTED_MIN_TOKENS) return null;
  return evidence.englishOnly / evidence.words < UNLISTED_MAX_ENGLISH_SHARE
    ? native
    : null;
}

export function provenHomeDefault(
  proof: HomeDefaultProof,
): AppStoreLocalization | null {
  const echoed = (tag: AppStoreLocalization): boolean =>
    proof.probes.some((probe) => probe.localization === tag && probe.echoed);
  const suspect = suspectedHomeDefault(proof);
  if (suspect !== null) return echoed(suspect) ? suspect : null;
  const natives = nativeLocalizations(proof.home);
  const declared = new Set(proof.declared.map(declaredLanguage));
  const candidates = natives.filter(echoed).filter(allowedBy(declared));
  if (candidates.length === 0) return null;
  const evidence = languageEvidence(proof.description);
  if (evidence.tokens === 0) return null;
  return unlistedNative(natives, candidates, declared, evidence);
}
