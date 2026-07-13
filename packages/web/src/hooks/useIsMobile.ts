// Responsive breakpoint hook (Story 11.2, AC1). Tracks a single mobile
// breakpoint — window matches (max-width: 760px) — mirroring the design's
// class-component `isMobile` state (Share2Brain Web.dc.html L808-819). One
// breakpoint, no tablet tier; isDesktop === !isMobile.
//
// THE guard: jsdom (and SSR) has no window.matchMedia. `App.tsx` calls this hook,
// so an unguarded matchMedia(...) would throw on first render and break every web
// unit test at once. `typeof window.matchMedia !== 'function'` in BOTH the
// initializer and the effect makes the hook return false (desktop) under jsdom —
// the desktop shell renders exactly as today and existing assertions stay green.
// In a real browser matchMedia always exists; the guard is purely for jsdom/SSR.
import { useEffect, useState } from 'react';

const MOBILE_QUERY = '(max-width: 760px)';

function readInitial(): boolean {
  return typeof window === 'undefined' || typeof window.matchMedia !== 'function'
    ? false
    : window.matchMedia(MOBILE_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(readInitial);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;

    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e: MediaQueryListEvent): void => setIsMobile(e.matches);

    // Feature-detect addEventListener/removeEventListener with the legacy
    // addListener/removeListener fallback (older Safari) — matches the design.
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else mq.addListener(onChange);

    // Re-sync in case the viewport changed between initial render and effect.
    setIsMobile(mq.matches);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
