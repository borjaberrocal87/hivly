import { describe, expect, it } from 'vitest';

import { isEmptyOrHttpUrl, LINK_REFINE_MESSAGE } from './linkRefine.js';

describe('isEmptyOrHttpUrl', () => {
  it('should accept an empty string (placeholder convention)', () => {
    expect(isEmptyOrHttpUrl('')).toBe(true);
  });

  it('should accept a valid http(s) URL', () => {
    expect(isEmptyOrHttpUrl('https://example.com/doc')).toBe(true);
  });

  it('should accept an uppercase-scheme URL (case-insensitive by construction)', () => {
    expect(isEmptyOrHttpUrl('HTTPS://Example.COM/Doc')).toBe(true);
  });

  it('should reject a non-URL string', () => {
    expect(isEmptyOrHttpUrl('not-a-url')).toBe(false);
  });

  it('should reject a URL with embedded whitespace', () => {
    expect(isEmptyOrHttpUrl('https://example.com/a b')).toBe(false);
  });

  it('should reject https:// with no host', () => {
    expect(isEmptyOrHttpUrl('https://')).toBe(false);
  });

  it('should reject a non-http(s) scheme', () => {
    expect(isEmptyOrHttpUrl('ftp://x')).toBe(false);
  });
});

describe('LINK_REFINE_MESSAGE', () => {
  it('should be a stable, human-readable message', () => {
    expect(LINK_REFINE_MESSAGE).toBe('link must be empty or a valid HTTP(S) URL');
  });
});
