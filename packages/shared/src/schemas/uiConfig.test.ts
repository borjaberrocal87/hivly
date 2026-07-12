import { describe, expect, it } from 'vitest';

import { UiConfigResponseSchema } from './uiConfig.js';

describe('UiConfigResponseSchema', () => {
  it('should accept { language: "es" }', () => {
    expect(UiConfigResponseSchema.safeParse({ language: 'es' }).success).toBe(true);
  });

  it('should accept { language: "en" }', () => {
    expect(UiConfigResponseSchema.safeParse({ language: 'en' }).success).toBe(true);
  });

  it('should reject an unsupported language', () => {
    expect(UiConfigResponseSchema.safeParse({ language: 'fr' }).success).toBe(false);
  });

  it('should reject a body missing language', () => {
    expect(UiConfigResponseSchema.safeParse({}).success).toBe(false);
  });

  it('should reject a non-string language value', () => {
    expect(UiConfigResponseSchema.safeParse({ language: 1 }).success).toBe(false);
  });
});
