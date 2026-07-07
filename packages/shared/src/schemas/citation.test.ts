import { describe, expect, it } from 'vitest';

import { CitationSchema } from './citation.js';

describe('CitationSchema', () => {
  it('should parse a citation with channel, author and date', () => {
    const result = CitationSchema.safeParse({
      channel: 'general',
      author: 'ada',
      date: '2026-07-06T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('should reject a citation missing a required field', () => {
    expect(CitationSchema.safeParse({ channel: 'general', author: 'ada' }).success).toBe(false);
  });

  it('should reject a non-string field', () => {
    expect(
      CitationSchema.safeParse({ channel: 'general', author: 'ada', date: 42 }).success,
    ).toBe(false);
  });
});
