// Shared `link` validation for SearchFragmentSchema, DocumentFragmentSchema, and
// CitationSchema (AD-6). `''` stays valid (backend seeds/legacy placeholders — 7.4
// updates the seed); a non-empty value must be a well-formed http(s) URL. Parse-based
// (not a prefix regex) so it is case-insensitive by construction and rejects a
// host-less `https://`, embedded whitespace, and trailing garbage. Deliberately not
// `z.string().url()` (deprecated) or strict `z.url()` (both reject `''`).
const HTTP_SCHEMES = new Set(['http:', 'https:']);

export function isEmptyOrHttpUrl(value: string): boolean {
  if (value === '') return true;
  if (/\s/.test(value)) return false;
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return HTTP_SCHEMES.has(url.protocol) && url.hostname !== '';
}

export const LINK_REFINE_MESSAGE = 'link must be empty or a valid HTTP(S) URL';
