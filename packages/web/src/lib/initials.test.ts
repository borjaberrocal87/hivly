import { describe, expect, it } from 'vitest';

import { initialsFromUsername } from './initials';

describe('initialsFromUsername', () => {
  it('should use the first letter of the first two words when multi-word', () => {
    expect(initialsFromUsername('Ada Lovelace')).toBe('AL');
  });

  it('should use the first two alphanumeric chars for a single token', () => {
    expect(initialsFromUsername('ada')).toBe('AD');
  });

  it('should skip non-alphanumeric characters in a single token', () => {
    expect(initialsFromUsername('_ada_dev')).toBe('AD');
  });

  it('should uppercase the result', () => {
    expect(initialsFromUsername('bob smith')).toBe('BS');
  });

  it('should handle a single-character username', () => {
    expect(initialsFromUsername('x')).toBe('X');
  });

  it('should fall back to "?" when there is no alphanumeric content', () => {
    expect(initialsFromUsername('___')).toBe('?');
    expect(initialsFromUsername('')).toBe('?');
  });
});
