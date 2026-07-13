import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useIsMobile } from './useIsMobile';

// A minimal fake MediaQueryList: `matches` is fixed at construction and a fired
// 'change' event drives the listeners. add/removeEventListener are spied so the
// listener lifecycle (AC1) can be asserted. Legacy add/removeListener are added
// only in the dedicated legacy-fallback test.
function createMatchMedia(initialMatches: boolean): {
  matchMedia: (query: string) => MediaQueryList;
  fireChange: (matches: boolean) => void;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const addEventListener = vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
    listeners.add(cb);
  });
  const removeEventListener = vi.fn((_type: string, cb: (e: MediaQueryListEvent) => void) => {
    listeners.delete(cb);
  });
  let matches = initialMatches;
  const mql = {
    matches,
    media: '(max-width: 760px)',
    addEventListener,
    removeEventListener,
  } as unknown as MediaQueryList;
  return {
    matchMedia: () => mql,
    fireChange: (next: boolean) => {
      matches = next;
      (mql as unknown as { matches: boolean }).matches = next;
      listeners.forEach((cb) => cb({ matches: next } as MediaQueryListEvent));
    },
    addEventListener,
    removeEventListener,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useIsMobile', () => {
  it('should return false (desktop) without throwing when matchMedia is undefined (jsdom/SSR)', () => {
    // test-setup.ts does NOT stub matchMedia and jsdom does not implement it — the
    // guard is what keeps every desktop-path unit test green (AC5).
    expect(typeof window.matchMedia).not.toBe('function');

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(false);
  });

  it('should initialize to the media query matches value', () => {
    const fake = createMatchMedia(true);
    vi.stubGlobal('matchMedia', fake.matchMedia);

    const { result } = renderHook(() => useIsMobile());

    expect(result.current).toBe(true);
  });

  it('should update the returned value when a change event fires', () => {
    const fake = createMatchMedia(false);
    vi.stubGlobal('matchMedia', fake.matchMedia);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      fake.fireChange(true);
    });

    expect(result.current).toBe(true);
  });

  it('should subscribe on mount and unsubscribe on unmount', () => {
    const fake = createMatchMedia(false);
    vi.stubGlobal('matchMedia', fake.matchMedia);

    const { unmount } = renderHook(() => useIsMobile());
    expect(fake.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    unmount();
    expect(fake.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('should fall back to legacy addListener/removeListener (older Safari)', () => {
    const listeners = new Set<(e: MediaQueryListEvent) => void>();
    const addListener = vi.fn((cb: (e: MediaQueryListEvent) => void) => void listeners.add(cb));
    const removeListener = vi.fn(
      (cb: (e: MediaQueryListEvent) => void) => void listeners.delete(cb),
    );
    const mql = {
      matches: true,
      media: '(max-width: 760px)',
      addListener,
      removeListener,
    } as unknown as MediaQueryList;
    vi.stubGlobal('matchMedia', () => mql);

    const { result, unmount } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
    expect(addListener).toHaveBeenCalledWith(expect.any(Function));

    unmount();
    expect(removeListener).toHaveBeenCalledWith(expect.any(Function));
  });
});
