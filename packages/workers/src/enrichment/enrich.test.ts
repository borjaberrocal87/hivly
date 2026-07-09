import { describe, expect, it } from 'vitest';

import { buildEmbeddingText, EnrichmentError, enrich, type EnrichmentChatModel } from './enrich.js';
import type { PageHints } from './htmlText.js';

interface FakeModelOptions {
  structuredResult?: unknown;
  structuredThrows?: boolean;
  invokeContent?: string;
  invokeThrows?: boolean;
}

function makeFakeModel(options: FakeModelOptions): {
  model: EnrichmentChatModel;
  prompts: { structured: string[]; fallback: string[] };
} {
  const prompts = { structured: [] as string[], fallback: [] as string[] };
  const model: EnrichmentChatModel = {
    withStructuredOutput: () => ({
      invoke: async (prompt: string) => {
        prompts.structured.push(prompt);
        if (options.structuredThrows) throw new Error('structured output boom');
        return options.structuredResult;
      },
    }),
    invoke: async (prompt: string) => {
      prompts.fallback.push(prompt);
      if (options.invokeThrows) throw new Error('invoke boom');
      return { content: options.invokeContent ?? '' };
    },
  };
  return { model, prompts };
}

const HINTS: PageHints = {
  title: 'Example Page',
  metaDescription: 'An example meta description',
  ogTitle: '',
  ogDescription: '',
  bodyText: 'Some page body text.',
};

describe('enrich', () => {
  it('should return the normalized result on structured-output success', async () => {
    const { model } = makeFakeModel({
      structuredResult: { title: '  My Title  ', description: '  My Description  ' },
    });
    const result = await enrich(model, {
      messageText: 'check this out',
      pageHints: HINTS,
      language: 'en',
    });
    expect(result).toEqual({ title: 'My Title', description: 'My Description' });
  });

  it('should fall back to plain invoke + JSON parsing when structured output throws', async () => {
    const { model } = makeFakeModel({
      structuredThrows: true,
      invokeContent: '```json\n{"title": "Fallback Title", "description": "Fallback Description"}\n```',
    });
    const result = await enrich(model, {
      messageText: 'check this out',
      pageHints: HINTS,
      language: 'en',
    });
    expect(result).toEqual({ title: 'Fallback Title', description: 'Fallback Description' });
  });

  it('should fall back when the structured-output result fails the Zod parse', async () => {
    const { model } = makeFakeModel({
      structuredResult: { title: 42, description: null }, // wrong types → zod parse fails
      invokeContent: '{"title": "Fallback Title 2", "description": "Fallback Description 2"}',
    });
    const result = await enrich(model, {
      messageText: 'check this out',
      pageHints: HINTS,
      language: 'en',
    });
    expect(result).toEqual({ title: 'Fallback Title 2', description: 'Fallback Description 2' });
  });

  it('should throw EnrichmentError when structured output throws AND the fallback also fails', async () => {
    const { model } = makeFakeModel({ structuredThrows: true, invokeThrows: true });
    await expect(
      enrich(model, { messageText: 'x', pageHints: null, language: 'en' }),
    ).rejects.toThrow(EnrichmentError);
  });

  it('should throw EnrichmentError when the fallback JSON is unparseable', async () => {
    const { model } = makeFakeModel({ structuredThrows: true, invokeContent: 'not json at all' });
    await expect(
      enrich(model, { messageText: 'x', pageHints: null, language: 'en' }),
    ).rejects.toThrow(EnrichmentError);
  });

  it('should throw EnrichmentError when structured output succeeds with an empty title', async () => {
    const { model } = makeFakeModel({
      structuredResult: { title: '   ', description: 'A real description' },
    });
    await expect(
      enrich(model, { messageText: 'x', pageHints: HINTS, language: 'en' }),
    ).rejects.toThrow(EnrichmentError);
  });

  it('should throw EnrichmentError when structured output succeeds with an empty description', async () => {
    const { model } = makeFakeModel({
      structuredResult: { title: 'A real title', description: '' },
    });
    await expect(
      enrich(model, { messageText: 'x', pageHints: HINTS, language: 'en' }),
    ).rejects.toThrow(EnrichmentError);
  });

  it('should throw EnrichmentError when the fallback succeeds but yields an empty field', async () => {
    const { model } = makeFakeModel({
      structuredThrows: true,
      invokeContent: '{"title": "", "description": "something"}',
    });
    await expect(
      enrich(model, { messageText: 'x', pageHints: HINTS, language: 'en' }),
    ).rejects.toThrow(EnrichmentError);
  });

  it('should carry enrichment.language into the prompt', async () => {
    const { model, prompts } = makeFakeModel({
      structuredResult: { title: 'T', description: 'D' },
    });
    await enrich(model, { messageText: 'hola', pageHints: HINTS, language: 'es' });
    expect(prompts.structured[0]).toContain('es');
  });

  it('should tell the model the page content was unavailable when pageHints is null', async () => {
    const { model, prompts } = makeFakeModel({ structuredResult: { title: 'T', description: 'D' } });
    await enrich(model, { messageText: 'a link with no fetch', pageHints: null, language: 'en' });
    expect(prompts.structured[0].toLowerCase()).toContain('unavailable');
    expect(prompts.structured[0]).toContain('a link with no fetch');
  });

  it('should include page hints in the prompt when fetch succeeded', async () => {
    const { model, prompts } = makeFakeModel({ structuredResult: { title: 'T', description: 'D' } });
    await enrich(model, { messageText: 'see this', pageHints: HINTS, language: 'en' });
    expect(prompts.structured[0]).toContain('Example Page');
    expect(prompts.structured[0]).toContain('Some page body text.');
  });
});

describe('buildEmbeddingText', () => {
  it('should join title and description with a blank line', () => {
    expect(buildEmbeddingText('My Title', 'My Description')).toBe('My Title\n\nMy Description');
  });
});
