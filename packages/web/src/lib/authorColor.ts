// Deterministic avatar background color for a given author seed (AC4). Same
// seed always maps to the same palette entry, so the "same" author looks
// consistent across cards without persisting a color anywhere. Pure — unit-tested.
const PALETTE = [
  '#5865F2',
  '#3BA55D',
  '#F5A623',
  '#ED4245',
  '#9B59B6',
  '#1ABC9C',
  '#E67E22',
  '#3498DB',
];

/** Deterministic hex color for the given seed (e.g. an author id). */
export function authorColor(seed: string): string {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) {
    sum += seed.charCodeAt(i);
  }
  return PALETTE[sum % PALETTE.length];
}
