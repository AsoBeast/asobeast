export const GENRE_VOTE_DEPTH = 10;

const POPULARITY_GENRE_BY_STORE_GENRE: Record<string, string> = {
  '6000': 'BUSINESS',
  '6001': 'PRODUCTIVITY_UTILITIES',
  '6002': 'PRODUCTIVITY_UTILITIES',
  '6003': 'TRAVEL',
  '6004': 'SPORTS',
  '6005': 'SOCIAL_NETWORKING',
  '6006': 'EDUCATION',
  '6007': 'PRODUCTIVITY_UTILITIES',
  '6008': 'PHOTO_VIDEO',
  '6009': 'NEW_PUBLICATION',
  '6010': 'TRAVEL',
  '6011': 'ENTERTAINMENT',
  '6012': 'LIFESTYLE',
  '6013': 'HEALTH_FITNESS',
  '6014': 'GAMES',
  '6015': 'FINANCE',
  '6016': 'ENTERTAINMENT',
  '6017': 'EDUCATION',
  '6018': 'NEW_PUBLICATION',
  '6020': 'HEALTH_FITNESS',
  '6021': 'NEW_PUBLICATION',
  '6023': 'FOOD_DRINK',
  '6024': 'SHOPPING',
  '6025': 'ENTERTAINMENT',
  '6026': 'PRODUCTIVITY_UTILITIES',
  '6027': 'PRODUCTIVITY_UTILITIES',
};

export function inferPopularityGenre(
  results: Array<{ genreId?: string }>,
): string | undefined {
  const votes = new Map<string, number>();
  for (const { genreId } of results.slice(0, GENRE_VOTE_DEPTH)) {
    const genre = genreId && POPULARITY_GENRE_BY_STORE_GENRE[genreId];
    if (genre) {
      votes.set(genre, (votes.get(genre) ?? 0) + 1);
    }
  }
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
}
