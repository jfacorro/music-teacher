/** Text for searching: lower case and without accents ("Cancán" → "cancan"). */
const searchable = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Whether any of `texts` contains `query`, ignoring case and accents; an empty query matches. */
export function matchesQuery(query: string, ...texts: (string | null)[]): boolean {
  const wanted = searchable(query.trim());
  return texts.some((text) => text !== null && searchable(text).includes(wanted));
}
