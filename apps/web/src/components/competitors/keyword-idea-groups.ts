import type { CompetitorKeywordIdea } from "@asobeast/shared";

export interface KeywordIdeaGroup {
  seed: string;
  ideas: CompetitorKeywordIdea[];
}

export function groupIdeasBySeed(
  seeds: readonly string[],
  ideas: readonly CompetitorKeywordIdea[],
): KeywordIdeaGroup[] {
  const order = [...new Set([...seeds, ...ideas.map((idea) => idea.seed)])];
  return order
    .map((seed) => ({
      seed,
      ideas: ideas.filter((idea) => idea.seed === seed),
    }))
    .filter((group) => group.ideas.length > 0);
}

export function ideaSignal(idea: CompetitorKeywordIdea): string {
  const rank = `#${idea.suggestRank} in search suggestions`;
  return idea.popularity === null
    ? rank
    : `Apple popularity ${idea.popularity} · ${rank}`;
}

export function ideaUsers(
  idea: CompetitorKeywordIdea,
  unnamed: string,
): string | null {
  if (idea.usedBy.length === 0) return null;
  return `Covered by ${idea.usedBy.map((app) => app.name ?? unnamed).join(", ")}`;
}
