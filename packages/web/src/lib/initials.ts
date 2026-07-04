// Derive a 2-char avatar initials label from a username (AC5). Prefers the first
// letters of the first two whitespace-separated words (e.g. "Ada Lovelace" → "AL");
// for a single token, the first two alphanumeric characters ("ada_dev" → "AD").
// Falls back to "?" when nothing usable is present. Pure — unit-tested.
export function initialsFromUsername(username: string): string {
  const words = username.trim().split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    const first = firstAlnum(words[0]);
    const second = firstAlnum(words[1]);
    const combined = `${first}${second}`;
    if (combined) return combined.toUpperCase();
  }

  const alnum = username.replace(/[^a-zA-Z0-9]/g, '');
  if (alnum) return alnum.slice(0, 2).toUpperCase();

  return '?';
}

/** First alphanumeric character of a token, or '' if none. */
function firstAlnum(token: string): string {
  const match = token.match(/[a-zA-Z0-9]/);
  return match ? match[0] : '';
}
