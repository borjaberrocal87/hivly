// Unit tests for the pure pagination generators (AC-2, AC-4). No discord.js:
// fetchPage is a plain async fixture returning Discord-shaped pages, i.e. every
// page NEWEST-first (descending snowflake), exactly as the real API delivers them.
import { describe, expect, it, vi } from 'vitest';

import { gapPages, latestPages, type FetchPage, type RawBackfillMessage } from './pages.js';

/** Build a newest-first page from ascending ids (mirrors the real API ordering). */
function page(ids: string[]): RawBackfillMessage[] {
  return [...ids].reverse().map((id) => ({ id }));
}

/** Ascending ids `from..to` inclusive (small numbers stringified). */
function range(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

async function collect<T>(gen: AsyncGenerator<T[]>): Promise<T[][]> {
  const out: T[][] = [];
  for await (const p of gen) out.push(p);
  return out;
}

const ids = (pages: RawBackfillMessage[][]): string[][] => pages.map((p) => p.map((m) => m.id));

describe('gapPages', () => {
  it('should advance `after` to the max id of each page and stop when a page has fewer than 100', async () => {
    const calls: Array<{ after?: string; before?: string }> = [];
    const fetchPage: FetchPage = (opts) => {
      calls.push(opts);
      if (opts.after === '0') return Promise.resolve(page(range(1, 100)));
      if (opts.after === '100') return Promise.resolve(page(range(101, 130)));
      throw new Error(`unexpected fetch ${JSON.stringify(opts)}`);
    };

    const pages = await collect(gapPages(fetchPage, '0'));

    expect(calls).toEqual([{ after: '0' }, { after: '100' }]);
    expect(ids(pages)).toEqual([range(1, 100), range(101, 130)]);
  });

  it('should stop immediately when the first page is empty (no gap)', async () => {
    const fetchPage: FetchPage = () => Promise.resolve([]);

    const pages = await collect(gapPages(fetchPage, '42'));

    expect(pages).toEqual([]);
  });

  it('should sort each yielded page ascending by BigInt(id), not lexicographically', async () => {
    // 19-digit id is numerically GREATER than the 18-digit one but sorts lower as a string.
    const eighteen = '999999999999999999';
    const nineteen = '1000000000000000000';
    const fetchPage: FetchPage = () => Promise.resolve([{ id: nineteen }, { id: eighteen }]);

    const pages = await collect(gapPages(fetchPage, '1'));

    expect(ids(pages)).toEqual([[eighteen, nineteen]]);
  });

  it('should call throttle between page fetches but not after the last page', async () => {
    const throttle = vi.fn().mockResolvedValue(undefined);
    const fetchPage: FetchPage = (opts) =>
      Promise.resolve(opts.after === '0' ? page(range(1, 100)) : page(range(101, 110)));

    await collect(gapPages(fetchPage, '0', { throttle }));

    expect(throttle).toHaveBeenCalledTimes(1);
  });

  it('should stop before the next fetch when the signal aborts mid-iteration', async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn((opts: { after?: string }) => {
      controller.abort(); // abort while the first page is in flight
      return Promise.resolve(opts.after === '0' ? page(range(1, 100)) : page(range(101, 200)));
    });

    const pages = await collect(gapPages(fetchPage, '0', { signal: controller.signal }));

    expect(pages).toHaveLength(1); // the in-flight page is still yielded…
    expect(fetchPage).toHaveBeenCalledTimes(1); // …but no further fetch happens
  });

  it('should not fetch at all when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchPage = vi.fn().mockResolvedValue(page(range(1, 100)));

    const pages = await collect(gapPages(fetchPage, '0', { signal: controller.signal }));

    expect(pages).toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe('latestPages', () => {
  it('should fetch backward with `before` and yield the window in chronological order', async () => {
    const calls: Array<{ after?: string; before?: string }> = [];
    const fetchPage: FetchPage = (opts) => {
      calls.push(opts);
      if (opts.before === undefined) return Promise.resolve(page(range(101, 200)));
      if (opts.before === '101') return Promise.resolve(page(range(1, 100)));
      throw new Error(`unexpected fetch ${JSON.stringify(opts)}`);
    };

    const pages = await collect(latestPages(fetchPage, 200));

    expect(calls).toEqual([{}, { before: '101' }]);
    expect(ids(pages).flat()).toEqual(range(1, 200)); // oldest → newest overall
  });

  it('should keep only the NEWEST `limit` messages when the last page overshoots', async () => {
    const fetchPage: FetchPage = (opts) =>
      Promise.resolve(
        opts.before === undefined ? page(range(101, 200)) : page(range(1, 100)),
      );

    const pages = await collect(latestPages(fetchPage, 150));

    // 200 collected, limit 150 → the oldest 50 (ids 1..50) are dropped.
    expect(ids(pages).flat()).toEqual(range(51, 200));
  });

  it('should stop early when the channel has fewer messages than the limit', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(range(1, 30))); // single short page

    const pages = await collect(latestPages(fetchPage, 1000));

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(ids(pages).flat()).toEqual(range(1, 30));
  });

  it('should yield nothing for an empty channel', async () => {
    const fetchPage: FetchPage = () => Promise.resolve([]);

    await expect(collect(latestPages(fetchPage, 1000))).resolves.toEqual([]);
  });

  it('should yield nothing when the limit is zero or negative', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(range(1, 100)));

    await expect(collect(latestPages(fetchPage, 0))).resolves.toEqual([]);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it('should call throttle between backward page fetches', async () => {
    const throttle = vi.fn().mockResolvedValue(undefined);
    const fetchPage: FetchPage = (opts) =>
      Promise.resolve(
        opts.before === undefined ? page(range(101, 200)) : page(range(1, 100)),
      );

    await collect(latestPages(fetchPage, 200, { throttle }));

    expect(throttle).toHaveBeenCalledTimes(1);
  });

  it('should stop collecting when the signal aborts and yield nothing', async () => {
    const controller = new AbortController();
    const fetchPage = vi.fn(() => {
      controller.abort();
      return Promise.resolve(page(range(101, 200)));
    });

    const pages = await collect(latestPages(fetchPage, 1000, { signal: controller.signal }));

    // Aborted mid-collection: better to yield nothing than a partial oldest-first
    // window that would corrupt the derived cursor on resume.
    expect(pages).toEqual([]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
