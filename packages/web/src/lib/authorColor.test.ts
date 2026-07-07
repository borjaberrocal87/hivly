import { describe, expect, it } from 'vitest';

import { authorColor } from './authorColor';

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

describe('authorColor', () => {
  it('should return the same color for the same seed (deterministic)', () => {
    expect(authorColor('author-1')).toBe(authorColor('author-1'));
  });

  it('should return a color from the fixed palette', () => {
    expect(PALETTE).toContain(authorColor('author-1'));
    expect(PALETTE).toContain(authorColor('9876543210'));
  });

  it('should return colors for different seeds (not necessarily distinct, but valid)', () => {
    const a = authorColor('alpha');
    const b = authorColor('beta');
    expect(PALETTE).toContain(a);
    expect(PALETTE).toContain(b);
  });

  it('should handle an empty seed', () => {
    expect(PALETTE).toContain(authorColor(''));
  });
});
