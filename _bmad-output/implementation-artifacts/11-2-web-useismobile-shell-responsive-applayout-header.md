---
baseline_commit: 6429e0c98807f3e840a1c7c28002f7e1eb0bc574
---

# Story 11.2: web — Hook `useIsMobile` + shell responsive (AppLayout + Header)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user of the Share2Brain web SPA on a phone or narrow window**,
I want **the app shell to adapt below 760px — the desktop sidebar replaced by a fixed bottom navigation bar (with the unread-docs badge) and the header collapsed to a logo + essential actions**,
so that **the app is navigable and readable on mobile instead of showing a fixed 236px sidebar and an overflowing header (today the SPA is desktop-only and unusable on a phone)**.

## Story Context

**Second story in Épico 11 (Responsive & Visual Refresh)**, binding sequence `11.1 (done) → **11.2** → (11.3 ∥ 11.4) → 11.5`. It introduces the **responsive shell**: the `useIsMobile` breakpoint hook plus the `AppLayout` sidebar↔bottom-nav switch and the `Header` mobile collapse. It is the foundation the later stories build on — 11.3 (views/`contentPad`) and 11.4 (chat FAB) both consume `isMobile`.

**Scope boundary (read this — it decides what you do NOT touch):**
- **11.2 (this story):** `useIsMobile` hook + `AppLayout` (Sidebar on desktop, new `BottomNav` on mobile) + `Header` collapse + dynamic `headerPad` (the header owns its own padding).
- **11.3 (NOT here):** `contentPad`. Each view — `SearchView` (`containerStyle` at line 26), `DocsView` (line 29), `StatsView` (line 18) — owns its own `padding: '34px 40px 60px'`. Making that padding dynamic (mobile `'22px 16px 104px'`, the 104px bottom clears the fixed bottom-nav) means editing those three views, which is 11.3's declared surface. **Do not edit the views' `containerStyle` in this story.** Also 11.3: DocsView `overflow-x`, Stats grids, Search fluid inputs.
- **11.4 (NOT here):** chat FAB/panel repositioning (`chatBottom`/`chatRight`). Leave `ChatWidget` untouched.
- **11.5 (NOT here):** the mobile + light-theme E2E harness. This story adds **no** new E2E specs and creates **no** new baselines.

**Interim state after 11.2 alone (expected, not a bug):** on mobile the bottom-nav renders and the header fits, but the views' bottom padding is still the desktop `60px`, so the last rows of scrollable content sit behind the 62px bottom-nav until 11.3 raises it to `104px`. This is a strict improvement over today (mobile is *fully* unusable now) and is resolved one story later in the binding sequence. **Desktop is untouched — zero desktop regression is a hard AC.**

**The mechanism is copied verbatim from the design.** `docs/context/design/Share2Brain Web.dc.html` is a class component that keeps `isMobile` in state; the React equivalent is a `useIsMobile` hook. Single breakpoint **`(max-width: 760px)`**, no tablet tier. 11.1 already realigned the token names to the design's canonical `--tx*` / `--bg-deep` / `--line` / `--accent-ink` / `--on-accent`, so you can paste the design's inline styles **without translating token names**.

## Acceptance Criteria

```gherkin
AC1 — useIsMobile hook: single 760px breakpoint, listener lifecycle, jsdom/SSR-safe
  Given a new hook packages/web/src/hooks/useIsMobile.ts
  When it initializes and while it is mounted
  Then it returns a boolean that is true iff window.matchMedia('(max-width: 760px)').matches
   And it subscribes to the media query's 'change' event on mount and unsubscribes on unmount,
       feature-detecting addEventListener/removeEventListener with a fallback to the legacy
       addListener/removeListener (older Safari) — exactly like the design (Web.dc.html L808-819)
   And when window.matchMedia is undefined (jsdom, SSR) it returns false (desktop) WITHOUT throwing
       — a bare `typeof window.matchMedia !== 'function'` guard in both the initializer and the effect
   And it follows the useTheme pattern: named export, explicit return type, header comment,
       lazy useState initializer, co-located useIsMobile.test.tsx.

AC2 — AppLayout renders sidebar on desktop, bottom-nav on mobile (conditional, never both)
  Given packages/web/src/components/AppLayout.tsx
  When isMobile is false (desktop)
  Then the 236px <Sidebar> renders exactly as today and NO bottom-nav is in the DOM
  When isMobile is true (mobile)
  Then <Sidebar> is NOT in the DOM and a fixed bottom <BottomNav> renders instead
   And the switch is a conditional render (isMobile ? <BottomNav/> : <Sidebar/>), never a
       CSS-hidden duplicate — so there is never more than one nav in the DOM at once
       (an accessible-name query like /Documentos/i must match exactly one button).

AC3 — BottomNav matches the design verbatim (bar, items, unread badge)
  Given the new packages/web/src/components/BottomNav.tsx (mobile-only)
  When it renders (compared to Web.dc.html L443-456, L828-831, L448-450)
  Then the bar is position:fixed; bottom:0; left:0; right:0; z-index:55; display:flex;
       align-items:stretch; height:62px; padding-bottom:env(safe-area-inset-bottom,0px);
       background:var(--bg-deep); border-top:1px solid var(--line)
   And it renders the SAME three nav items as the Sidebar (search/docs/stats), reusing the exact
       NAV_ITEMS definition + Screen type (i18n label KEYS, 18px icons) — accessible names identical
       to the sidebar (es Búsqueda/Documentos/Estadísticas, en Search/Documents/Stats)
   And each item is a <button>: flex:1; column; align/justify center; gap:3px; padding:8px 4px;
       border:none; background:transparent; font-size:10.5px; font-weight:500;
       active color var(--accent-ink), inactive var(--tx4); icon stacked above label; aria-current
       on the active item
   And the Documentos item shows the unread badge ONLY when the total unread count > 0:
       an absolutely-positioned span (top:-5px; right:-9px; min-width:15px; height:15px;
       padding:0 4px; IBM Plex Mono 9px/600; color var(--on-accent); background #F5A623;
       border-radius:8px) over a position:relative icon wrapper
   And the badge consumes the SAME total-unread prop path as the sidebar badge (App.totalUnread →
       unreadCount), not a new fetch.

AC4 — Header collapses on mobile
  Given packages/web/src/components/Header.tsx gains an isMobile prop
  When isMobile is true (compared to Web.dc.html L153-187)
  Then a 28px brand hexagon logo renders at the start of the left cluster (absent on desktop)
   And the stats separator + statsLine, the "indexando en vivo" pill, and the username span are
       NOT rendered
   And headerPad is '0 14px' (desktop stays '0 26px')
  When isMobile is false (desktop)
  Then the header renders exactly as today (no hexagon; separator + statsLine + live pill +
       username all present; padding '0 26px') — byte-identical behavior.
   And on BOTH viewports the Discord icon + community name, the user avatar, the theme-toggle
       button and the logout button still render.

AC5 — No desktop regression; existing unit + e2e stay green
  Given the whole existing test suite (Vitest unit incl. App.test.tsx; Playwright desktop harness)
  When it runs after the change WITHOUT stubbing matchMedia in test-setup.ts
  Then every existing assertion passes UNCHANGED, because jsdom has no window.matchMedia so
       useIsMobile returns false → the desktop sidebar + full header render exactly as today
       (community name in banner, nav buttons by name es+en, sidebar total badge "5" inside the
       Documentos button, the badge-race test, guest flow, logout) all hold
   And the Playwright 'chromium' project uses devices['Desktop Chrome'] (1280px > 760px) so the
       existing 28 e2e run desktop and every baseline snapshot is byte-identical (zero churn)
   And any new/changed unit test is limited to: useIsMobile.test.tsx (new) and a focused
       responsive component test (see Testing); no existing spec's assertions are edited.

AC6 — safe-area works; body never scrolls horizontally
  Given index.html and the mobile layout
  When rendered on a notched device
  Then the viewport meta includes viewport-fit=cover so env(safe-area-inset-bottom) resolves > 0
       (without it, safe-area insets are always 0 on iOS — AC3's padding-bottom would be dead)
   And at 360px width the body does not scroll horizontally (the shell stays width:100vw;
       overflow:hidden; the bottom-nav is position:fixed and does not widen the document).

AC7 — Verification gate green; frontend-only; invariants intact
  Given the mandatory gate
  When "npm run lint && npm run test && npm run build" runs (agent runs it, pastes output)
  Then all pass with no red, and the E2E desktop harness passes with zero baseline churn
   And the diff touches packages/web ONLY — zero change to shared, backend, workers, bot, the
       Drizzle schema, any Zod contract, or any API/SSE shape (AD-3 + AD-6 intact)
   And NO new runtime dependency is added (useIsMobile is hand-rolled over window.matchMedia).
```

## Tasks / Subtasks

- [x] **Task 1 — Create the `useIsMobile` hook (AC1)**
  - [x] New `packages/web/src/hooks/useIsMobile.ts`. Module const `MOBILE_QUERY = '(max-width: 760px)'`.
  - [x] `readInitial(): boolean` → `typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? false : window.matchMedia(MOBILE_QUERY).matches`.
  - [x] `export function useIsMobile(): boolean` with `useState<boolean>(readInitial)` (lazy initializer).
  - [x] `useEffect(() => {...}, [])`: guard `matchMedia` absent → early `return`; else get `mq`, define `onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)`, subscribe via `mq.addEventListener?.('change', onChange)` with `else mq.addListener(onChange)`, re-sync `setIsMobile(mq.matches)`, and return a cleanup that removes the listener (feature-detected the same way).
  - [x] Header comment (Story 11.2) explaining the 760px breakpoint + why the matchMedia guard exists (jsdom has no matchMedia).
- [x] **Task 2 — Wire `isMobile` from `App.tsx` down the shell (AC2, AC4)**
  - [x] In `App.tsx` call `const isMobile = useIsMobile();` (next to the existing `useTheme()` call) and pass `isMobile={isMobile}` to `<AppLayout>`. **Do NOT** pass it to `<ChatWidget>` yet — that is 11.4.
  - [x] `AppLayout`: add `isMobile: boolean` to `AppLayoutProps`; use it to switch nav and pass it to `<Header>`.
- [x] **Task 3 — Create `BottomNav.tsx` and switch it in `AppLayout` (AC2, AC3)**
  - [x] Export the existing `NAV_ITEMS` const from `Sidebar.tsx` (add `export`) so `BottomNav` reuses the single nav definition (`Screen`/`labelKey`/`icon`). `Screen` is already exported.
  - [x] New `packages/web/src/components/BottomNav.tsx`. Props: `{ activeScreen: Screen; onNavigate: (s: Screen) => void; unreadCount?: number }` (default 0), mirroring the Sidebar badge contract.
  - [x] Render `<nav>` with the exact bar style (AC3). Map `NAV_ITEMS` → `<button>` per item; `onClick={() => onNavigate(item.screen)}`; active = `item.screen === activeScreen` (sets color + `aria-current="page"`); label via `t(item.labelKey)`.
  - [x] Documentos badge: only `screen === 'docs' && unreadCount > 0` → absolute-positioned span over a `position:relative` icon wrapper, exact style per AC3.
  - [x] In `AppLayout`, replace the single `<Sidebar>` with `{isMobile ? <BottomNav activeScreen onNavigate unreadCount={unreadCount} /> : <Sidebar activeScreen onNavigate unreadCount={unreadCount} />}`. Keep the `shellStyle`/`contentColumnStyle` and the `overflow:hidden` shell intact (ChatWidget relies on it).
  - [x] Bottom-nav item colors are state-driven (active/inactive), NOT `:hover`, so inline styles are correct here (no cascade-vs-hover trap). Optionally add a `:focus-visible` outline (a11y convention, D5 from 11.1) — either a small `.kh-bottom-nav-item` class in `components.css` or reuse an existing focus outline.
- [x] **Task 4 — Header mobile collapse (AC4)**
  - [x] Add `isMobile: boolean` to `HeaderProps`; `AppLayout` passes it.
  - [x] Mobile hexagon: render `<Hexagon size={28} innerBg="bg" />` at the start of the left cluster when `isMobile` (absent otherwise). **Add `28: 16` to `EXACT_MIDDLE` in `Hexagon.tsx`** so the 28px hex matches the design (outer 28 / middle 16 / dot 5 — the dot already interpolates to 5). This is a one-line reuse of the existing primitive, not a re-inline.
  - [x] Gate the stats separator + statsLine (Header:66-75), the live-indexing pill (Header:79-102) and the username span (Header:140) behind `!isMobile`.
  - [x] `headerStyle.padding`: make it dynamic — `padding: isMobile ? '0 14px' : '0 26px'` (compute inline off the prop; padding is not a pseudo-class property so inline is safe). Everything else in `headerStyle` unchanged.
- [x] **Task 5 — Guest badge on mobile + viewport-fit (AC4, AC6)**
  - [x] **D3 — REVERSED per Borja (2026-07-13):** the guest-mode badge stays visible on mobile too (no `!isMobile` gate; only `isGuest` gates the pill, as in Story 2.5). Original default was to hide it — Borja chose to keep the "Modo invitado" state explicit on mobile.
  - [x] `index.html`: change the viewport meta to `content="width=device-width, initial-scale=1.0, viewport-fit=cover"` so `env(safe-area-inset-bottom)` resolves on iOS.
- [x] **Task 6 — Tests (AC1, AC5)**
  - [x] New `packages/web/src/hooks/useIsMobile.test.tsx` (mirror `useTheme.test.tsx`): stub `window.matchMedia` via `vi.stubGlobal` with a fake `MediaQueryList` (matches + add/removeEventListener spies). Assert: initial value tracks `matches`; a fired `change` event updates the returned value; `addEventListener`/`removeEventListener` (or legacy) are called on mount/unmount; with `matchMedia` unstubbed/undefined it returns `false` and does not throw.
  - [x] New focused responsive test (`AppLayout.test.tsx`): render with `isMobile` explicitly true and false (the prop is drilled → trivially testable). Assert desktop → sidebar present, bottom-nav absent, statsLine/live-pill/username present; mobile → bottom-nav present, sidebar absent, statsLine/live-pill/username absent, hexagon present, and the Documentos bottom-nav button carries the unread badge when `unreadCount > 0`.
  - [x] Do **not** add a `matchMedia` stub to `test-setup.ts` (keep existing tests on the guard's desktop default). Do **not** edit any existing assertion in `App.test.tsx` — verify it stays green untouched.
- [x] **Task 7 — Verification gate + docs sync (AC5, AC7)**
  - [x] Run `npm run lint && npm run test && npm run build` (repo-wide) — paste output. Never commit red.
  - [x] Run the E2E desktop harness (`test:e2e`, Chromium, dark, 1280px) — expect **28 passed, zero baseline churn**. If any snapshot diffs, a desktop value moved by mistake — stop and audit.
  - [x] Confirm `git diff --name-only <baseline> -- packages/` is `web` only.
  - [x] No `TECHNICAL-DESIGN.md` / `frontend-standards.md` change needed — both were already updated with the responsive rule when Épico 11 was planned (frontend-standards.md:189-197, TECHNICAL-DESIGN.md:364). Leave them.

## Dev Notes

### The wiring decision (D1) — call `useIsMobile()` in `App.tsx`, drill `isMobile` down

`App.tsx` already calls `useTheme()` and drills `theme` to `AppLayout`/`Header`; do the same for `isMobile`. One hook instance, one source of truth, and **components receive `isMobile` as a prop → they are trivially testable both ways** (this is why the focused component test in Task 6 is easy). 11.3 will drill `isMobile` further into the views and 11.4 into `ChatWidget`; this story only wires `App → AppLayout → {BottomNav, Header}`.

[Source: App.tsx:39-90,152-154 (theme/unread drilling precedent); packages/web/src/hooks/useTheme.ts (hook pattern)]

### THE critical guardrail (AC5) — the jsdom `matchMedia` guard is the linchpin

`packages/web/src/test-setup.ts` does **not** stub `matchMedia`, and jsdom does not implement it. If `useIsMobile` calls `window.matchMedia(...)` **unguarded**, it throws on first render — and since `App.tsx` calls the hook, **every one of the ~100 web unit tests (App.test.tsx included) breaks at once.** The `typeof window.matchMedia !== 'function'` guard in both the initializer and the effect makes the hook return `false` (desktop) under jsdom, so the desktop sidebar + full header render exactly as today and **zero existing assertions change**. This is not optional polish — it is what keeps AC5 true. In a real browser `matchMedia` always exists; the guard is purely for jsdom/SSR.

The must-stay-green `App.test.tsx` assertions (all rely on the desktop path): community name scoped to `getByRole('banner')`; nav buttons found by accessible name (`/Búsqueda|Documentos|Estadísticas/i` and EN `/Search|Documents|Stats/i`); the sidebar total badge (`findByText('5')` from `{ 'chan-1':3,'chan-2':2 }`); the generation-token badge race (`'1'` never `'99'`, asserted *inside* the Documentos button); guest flow (`guest-mode-badge`, `Invitado`/`IN`, logout `/Salir/i`); logout returns to login (no `banner`).

[Source: App.test.tsx:89-324; packages/web/src/test-setup.ts]

### Why "conditional render, never both navs" matters (AC2)

Several `App.test.tsx` queries use `getByRole('button', { name: /Documentos/i })` and `within(...)` that button. `getByRole` **throws on multiple matches.** If the mobile bottom-nav and the desktop sidebar both render (one merely CSS-hidden), there would be two `Documentos` buttons and those queries would break even on desktop. The design renders them mutually exclusively (`sc-if isDesktop` / `sc-if isMobile`, Web.dc.html L112 / L443) — reproduce that with `isMobile ? <BottomNav/> : <Sidebar/>`. jsdom → `isMobile=false` → only the sidebar exists → queries are unambiguous.

### Verbatim design values (paste these; tokens already match post-11.1)

**Breakpoint & hook mechanism** [Web.dc.html L611, L808-819, L1094-1095]:
- Query: `(max-width: 760px)`. `isDesktop === !isMobile`. Single breakpoint, no tablet tier.
- Design's listener (the shape to reproduce in the hook):
```js
this._mq = window.matchMedia('(max-width: 760px)');
this._onMq = (e) => this.setState({ isMobile: e.matches });
if (this._mq.addEventListener) this._mq.addEventListener('change', this._onMq);
else this._mq.addListener(this._onMq);
this.setState({ isMobile: this._mq.matches });
// cleanup: removeEventListener / legacy removeListener
```

**Bottom-nav bar** [Web.dc.html L444]:
```
position:fixed; bottom:0; left:0; right:0; z-index:55; display:flex; align-items:stretch;
height:62px; padding-bottom:env(safe-area-inset-bottom,0px); background:var(--bg-deep);
border-top:1px solid var(--line);
```

**Bottom-nav item** (`mobileNavStyle`, [Web.dc.html L828-831]):
```
position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center;
gap:3px; flex:1; padding:8px 4px; border:none; background:transparent; cursor:pointer;
font-size:10.5px; font-weight:500; transition:color .12s ease;
/* active: */ color:var(--accent-ink);  /* inactive: */ color:var(--tx4);
```
Icon 18px stacked above the label span. (Contrast: desktop sidebar item = `navStyle`, L822-827 — unchanged, keep as-is.)

**Bottom-nav unread badge** [Web.dc.html L448-450], over a `position:relative` icon wrapper:
```
position:absolute; top:-5px; right:-9px; min-width:15px; height:15px; padding:0 4px;
display:flex; align-items:center; justify-content:center; font-family:'IBM Plex Mono',monospace;
font-size:9px; font-weight:600; color:var(--on-accent); background:#F5A623; border-radius:8px;
```
Only Documentos carries it (`unreadCount > 0`); `#F5A623` is a sanctioned brand hex (global.css allowlist). The count is the App-summed total — `unreadCount` prop, same path as the sidebar badge (`App.totalUnread = Object.values(unreadCounts).reduce(...)`, App.tsx:90 → AppLayout → nav).

**Header mobile hexagon** [Web.dc.html L155-161]: outer 28 / middle 16 (`var(--bg)`) / dot 5 (`#F5A623`). Reuse `<Hexagon size={28} innerBg="bg" />` after adding `28: 16` to `EXACT_MIDDLE` (Hexagon.tsx:20) — dot already `round(28*0.19)=5`.

**Header hidden-on-mobile** [Web.dc.html L166-169 stats, L172-177 live pill, L180-182 username] — all wrapped `isDesktop` in the design. **Persist on both** [L162-165 Discord icon+name, L178-186 avatar/theme/logout].

**Dynamic padding** [Web.dc.html L1096]: `headerPad: isMobile ? '0 14px' : '0 26px'`. (`contentPad: isMobile ? '22px 16px 104px' : '34px 40px 60px'` is listed here too but is **11.3's** — the views own it; do not touch.)

**safe-area** [Web.dc.html L444]: the only `env(safe-area-inset-*)` in the whole design is the bottom-nav's `padding-bottom:env(safe-area-inset-bottom,0px)`. Requires `viewport-fit=cover` in the `index.html` viewport meta (currently missing) to resolve on iOS.

[Source: docs/context/design/Share2Brain Web.dc.html — lines cited inline]

### Current shell (what you are modifying) — exact state today

- **`AppLayout.tsx`** (91 lines): outer flex row `shellStyle {display:flex; height:100vh; width:100vw; overflow:hidden}` → `<Sidebar activeScreen onNavigate unreadCount={unreadCount} />` + `contentColumnStyle {flex:1; minWidth:0; column}` holding `<Header .../>` + the view ternary (AppLayout.tsx:80-86). No state, no effects. `overflow:hidden` is load-bearing (ChatWidget fixed sibling).
- **`Header.tsx`** (167 lines): `<header>` (role `banner`), `headerStyle` height 62 padding `'0 26px'` border-bottom `1px solid var(--line)`. Left cluster: Discord icon(17) + name(600/15) + separator(`1px×18 var(--border-strong)`) + statsLine(mono 11.5 `var(--tx4)`). Right cluster (gap 12): live pill (`data-testid="live-pulse"` dot, `kh-pulse`), guest badge (`data-testid="guest-mode-badge"`, `isGuest` only), user cluster {avatar 30 `#5865F2`, name 13.5 `var(--tx2)`, `.kh-icon-btn` theme toggle, `.kh-icon-btn.kh-logout-btn` logout}. Uses `useTranslation()`.
- **`Sidebar.tsx`** (192 lines): `asideStyle` width **236** `var(--bg-deep)` right-border `var(--line)` padding `18px 14px`. `NAV_ITEMS` (module const, labelKeys + 18px icons) → three `.kh-nav-item` buttons, `aria-current` on active, badge `data-testid="sidebar-badge"` when `docs && unreadCount>0` (`badgeStyle`: min-width 18 height 18 mono 10.5 `#F5A623` `var(--on-accent)` radius 9). Then status panel + footer. Also renders the "Share2Brain" wordmark (Space Grotesk 700/17).
- **`hooks/`**: only `useTheme.ts` + `useTheme.test.tsx`. No `useIsMobile`/`useMediaQuery`/`matchMedia` anywhere in `src/`.
- **Unread wiring**: `App.tsx` owns `unreadCounts` state (`api/readStatus.ts` `fetchUnreadCount` → `GET /api/read-status/unread-count`, RBAC-scoped, generation-token guarded), computes `totalUnread` (App.tsx:90), drills `unreadCount={totalUnread}` → AppLayout → Sidebar badge. Per-channel `unreadCounts` → DocsView. Keep this exact path; the bottom-nav badge just reads the same `unreadCount`.

[Source: packages/web/src/components/{AppLayout,Header,Sidebar}.tsx; App.tsx:39-90,152-154; api/readStatus.ts]

### Decisions (ratified defaults — flag at PR)

- **D1 — `useIsMobile()` called in `App.tsx`, `isMobile` drilled as a prop** (not each component calling the hook). Mirrors the `useTheme` precedent, one source of truth, and makes the shell components prop-testable. Reversible.
- **D2 — New `BottomNav.tsx` reusing exported `NAV_ITEMS` + `Screen` from `Sidebar.tsx`**, rather than teaching `Sidebar` to render two layouts. The bottom-nav is only the nav row (no logo/status/footer), so a small dedicated component is cleaner; reusing `NAV_ITEMS` keeps a single nav definition and guarantees accessible-name parity for the tests. Trade-off: one small `export` added to `Sidebar.tsx`.
- **D3 — Hide the guest-mode badge on mobile** (gate behind `!isMobile`, like the live pill). Both are right-cluster pills; mobile is tight. Guest state stays visible via the logout label `/Salir/i`. *Reversible:* if Borja wants it on mobile, drop the one gate. The design has no guest scenario (it's a Story 2.5 repo addition), so there is no mock to copy — hence flagged.
- **D4 — Reuse `<Hexagon size={28}>` + add `EXACT_MIDDLE[28]=16`** instead of hand-inlining the design's 3-layer hex markup. Reuses the sanctioned primitive; exact match to the design (28/16/5). Reversible.
- **D5 — Bottom-nav item colors inline (state-driven), plus keep the a11y `:focus-visible` convention.** No `:hover` on the mobile nav (touch), so the "base value must be in CSS, not inline" cascade trap does not apply here — inline active/inactive color is correct. Add a `:focus-visible` outline to match the app-wide keyboard-a11y superset (11.1 D5).
- **D6 — `contentPad` deferred to 11.3, not this story.** The three views own their `containerStyle` padding; editing them is 11.3's declared surface, and doing it here would collide with 11.3. Documented interim: mobile content bottom is clipped behind the bottom-nav until 11.3. Desktop unaffected.

### Architecture & guardrails

- **Frontend-only, `packages/web` exclusively.** AD-3 (static SPA — responsiveness is pure client CSS/JS, no server, no per-device build) and AD-6 (no contract touched) stay intact. No Drizzle/Zod/API/SSE change. **No new dependency** (`useIsMobile` over `window.matchMedia`). [Source: epics.md#Épico-11; sprint-change-proposal-2026-07-13-responsive-refresh.md#2]
- **No raw hex outside the allowlist.** The only raw hex here is `#F5A623` (badge) — already sanctioned (amber). Everything else references tokens (`var(--bg-deep)`, `var(--line)`, `var(--accent-ink)`, `var(--tx4)`, `var(--on-accent)`). [Source: global.css:9-14 allowlist]
- **English only** in all code/comments/tests/commits. i18n label KEYS stay keys (never resolve `NAV_ITEMS` labels to text at import — D9 trap, Sidebar.tsx:67-69). [Source: project-context.md#Code quality]
- **One story at a time; branch first.** `git switch -c feat/11-2-useismobile-shell-responsive` off HEAD (`6429e0c`); never commit on `main`. Conventional Commits, scope `web`. [Source: project-context.md#Development workflow]

### Project Structure Notes

- Components live in `packages/web/src/components/` (there is **no** `views/` dir despite the epic's "vistas" prose). New files: `hooks/useIsMobile.ts` (+ `.test.tsx`), `components/BottomNav.tsx`.
- Layout values live **inline** in each component's `CSSProperties`; only interactive `:hover`/`:focus` states live in `components.css` (`.kh-*`). This story adds JS-driven responsive layout (the house pattern is JS/inline, not `@media` — consistent with the design's `isMobile`-in-state approach). Do not introduce `@media` layout breakpoints; drive layout from `useIsMobile`. [Source: components.css:1-9; source-analysis §7]
- `data-kh` (theme) is orthogonal to layout — the new mobile chrome themes automatically via tokens. The hook does not touch `data-kh`.

### Testing

- **Unit (Vitest + RTL):** new `useIsMobile.test.tsx` (stub `window.matchMedia` via `vi.stubGlobal`, mirror `useTheme.test.tsx`) + one focused responsive component test driving `isMobile` both ways. All other unit tests stay green **untouched** (the matchMedia guard → desktop default). [Source: useTheme.test.tsx; project-context.md#Testing]
- **E2E visual (Playwright, existing dark-desktop harness):** `chromium` project = `devices['Desktop Chrome']` (1280px > 760px) → desktop path → 28 passed, **zero baseline churn**. Any snapshot diff means a desktop value moved by accident — stop and audit. Mobile + light-theme baselines are **11.5's** job, deferred by name. [Source: playwright.config.ts:32; epics.md#Historia-11.5]
- **No integration run needed** (web-only, no shared/backend touch) — mirrors 9.2/10.2/11.1.
- E2E boot note (from 11.1): `e2e:server` needs `DATABASE_URL` + `REDIS_URL` (no default). Local: `DATABASE_URL` → Docker Postgres :5432, `REDIS_URL=redis://127.0.0.1:6379` (tests/README.md).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Épico-11 · Historia-11.2] — story scope, binding sequence, FR27.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-responsive-refresh.md] — Moderate, AD-3/AD-6 intact, frontend-only, no new dependency, risk Low; success criteria (usable at 360px, no body h-scroll).
- [Source: docs/context/design/Share2Brain Web.dc.html] — L611/L808-819/L1094-1095 (breakpoint+listener), L443-456/L828-831 (bottom-nav), L448-450 (mobile badge), L153-187 (header responsive), L155-161 (mobile hexagon), L1096 (headerPad), L444 (safe-area).
- [Source: _bmad-output/implementation-artifacts/11-1-web-refresh-design-tokens-estados-interaccion.md] — token realignment (`--tx*`/`--dot-read`), the components.css cascade rule, the a11y `:focus-visible` superset (D5), the defaults-flagged-for-review pattern.
- [Source: packages/web/src/components/{AppLayout,Header,Sidebar,Hexagon}.tsx; App.tsx; hooks/useTheme.ts; test-setup.ts; App.test.tsx; playwright.config.ts; index.html] — current shell, wiring, tests, config.
- [Source: docs/frontend-standards.md#UI/UX-Standards:189-197] — 760px breakpoint, sidebar↔bottom-nav, safe-area, no body h-scroll, mobile+light E2E rule.
- [Source: docs/context/TECHNICAL-DESIGN.md §5.5:364] — Responsive (Épico 11) paragraph.
- [Source: docs/context/ARCHITECTURE-SPINE.md] — AD-3 (static SPA), AD-6 (contracts in shared).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story)

### Debug Log References

- E2E harness env: `e2e:server` has no default `DATABASE_URL`/`REDIS_URL`, so the Playwright run
  was launched with both exported (values from `.env` → local Docker Postgres :5432 + Redis :6379).
  Harmless boot log `[embeddingDimensions] failed to read config file "Share2Brain.config.yml" …
  falling back to 1536` — pre-existing, unrelated to this story.

### Completion Notes List

- **AC1 — `useIsMobile` hook:** single `(max-width: 760px)` breakpoint, lazy `useState` initializer,
  listener subscribe/unsubscribe with `addEventListener`→legacy `addListener` fallback, and the
  `typeof window.matchMedia !== 'function'` guard in BOTH the initializer and the effect (the AC5
  linchpin — jsdom has no matchMedia → hook returns `false`/desktop → all existing unit tests stay
  green). Mirrors the `useTheme` house pattern (named export, explicit return type, header comment,
  co-located `.test.tsx`).
- **AC2 — Shell switch:** `App.tsx` calls `useIsMobile()` next to `useTheme()` and drills `isMobile`
  to `AppLayout` (NOT to `ChatWidget` — that is 11.4). `AppLayout` renders
  `{isMobile ? <BottomNav/> : <Sidebar/>}` — a conditional render, never a CSS-hidden duplicate, so
  `/Documentos/i` matches exactly one button on both viewports.
- **AC3 — `BottomNav`:** new mobile-only component reusing the now-exported `NAV_ITEMS` + `Screen`
  from `Sidebar` (accessible-name parity). Bar/item/badge styles pasted verbatim from the design
  (Web.dc.html L444, L828-831, L448-450); tokens already match post-11.1. Documentos badge
  (`data-testid="bottom-nav-badge"`) renders only when `unreadCount > 0`, reading the same
  `App.totalUnread → unreadCount` prop path as the sidebar badge (no new fetch). `#F5A623` is the
  sanctioned allowlist amber; everything else references tokens.
- **AC4 — Header collapse:** `Header` gains `isMobile`. Mobile renders a `<Hexagon size={28}
  innerBg="bg" />` at the start of the left cluster (added `EXACT_MIDDLE[28]=16`; dot already
  interpolates to 5) and hides the stats separator + statsLine, the live-indexing pill and the
  username span. Padding is dynamic (`isMobile ? '0 14px' : '0 26px'`) computed inline off the prop;
  the rest of the header base style is unchanged. Discord icon + community name, avatar, theme toggle
  and logout persist on both viewports. Desktop path is byte-identical.
- **AC5 — No desktop regression:** no `matchMedia` stub added to `test-setup.ts`; no existing
  assertion edited. Full web suite 219/219, repo suite 1081 passed / 1 skipped (+8 new: 5 hook +
  3 shell), E2E 28 passed with zero baseline churn (Desktop Chrome 1280px > 760px → desktop path).
- **AC6 — safe-area / no h-scroll:** `index.html` viewport meta gains `viewport-fit=cover` so
  `env(safe-area-inset-bottom)` resolves on iOS. The shell stays `width:100vw; overflow:hidden`; the
  bottom-nav is `position:fixed` and does not widen the document.
- **AC7 — Gate + invariants:** lint clean, repo tests green, build clean (5 pkgs), E2E 28/0-churn.
  `git diff --name-only 6429e0c -- packages/` is `web` only — zero change to shared/backend/workers/
  bot, the Drizzle schema, any Zod contract, or any API/SSE shape (AD-3 + AD-6 intact). No new
  runtime dependency (`useIsMobile` is hand-rolled over `window.matchMedia`).
- **Decisions:** D1–D2, D4–D6 implemented as ratified. **D3 REVERSED per Borja (2026-07-13):** the
  guest-mode badge now shows on BOTH viewports — the `!isMobile` gate on the guest pill was dropped
  (only `isGuest` gates it, as in Story 2.5). Re-gate green after the change: lint 0 / web 219 /
  build clean; E2E unaffected (the desktop harness never renders <760px, and the guest-badge desktop
  path is byte-identical).
- **Interim state (expected, per Story Context / D6):** on mobile the views' bottom padding is still
  the desktop `60px`, so the last rows sit behind the 62px bottom-nav until 11.3 raises `contentPad`
  to `104px`. Not touched here — `contentPad` is 11.3's declared surface.

### File List

**Added:**
- `packages/web/src/hooks/useIsMobile.ts`
- `packages/web/src/hooks/useIsMobile.test.tsx`
- `packages/web/src/components/BottomNav.tsx`
- `packages/web/src/components/AppLayout.test.tsx`

**Modified:**
- `packages/web/src/App.tsx`
- `packages/web/src/components/AppLayout.tsx`
- `packages/web/src/components/Header.tsx`
- `packages/web/src/components/Sidebar.tsx` (export `NAV_ITEMS`)
- `packages/web/src/components/Hexagon.tsx` (`EXACT_MIDDLE[28]=16`)
- `packages/web/src/styles/components.css` (`.kh-bottom-nav-item:focus-visible`)
- `packages/web/index.html` (`viewport-fit=cover`)

### Change Log

- 2026-07-13 — Story 11.2 implemented: `useIsMobile` hook + responsive shell (AppLayout Sidebar↔
  BottomNav switch, Header mobile collapse, dynamic headerPad, `viewport-fit=cover`). Frontend-only,
  `packages/web` exclusively; AD-3 + AD-6 intact; no new dependency. Gate green (lint 0 / 1081 unit+
  web +8 / build 5 pkgs / 28 e2e, zero baseline churn). Status → review.
- 2026-07-13 — D3 reversed per Borja: guest-mode badge kept visible on mobile (dropped the `!isMobile`
  gate on the guest pill in `Header.tsx`). Re-gate green (lint 0 / web 219 / build clean; E2E
  unaffected).
- 2026-07-13 — Code-review patch (round 2): restored the design-verbatim community-name truncation on
  `Header.tsx` — `minWidth:0` on the name wrapper + `overflow:hidden; textOverflow:ellipsis;
  whiteSpace:nowrap` on the `{communityName}` span (`Web.dc.html:163-164`), which the initial impl had
  omitted. Prevents a long Discord guild name from overflowing the collapsed mobile header. Re-gate
  green (typecheck clean / web 219 / build clean / eslint 0). Applies on both viewports per the design;
  desktop E2E uses a short name → zero snapshot churn.

## Review Findings

_Code review (bmad-code-review, 2026-07-13, claude-opus-4-8): 3 layers (Blind Hunter, Edge Case
Hunter, Acceptance Auditor). 0 decision-needed · 0 patch · 2 defer · 9 dismissed as noise. Acceptance
Auditor: all 7 ACs SATISFIED, D3 reversal correct, scope boundaries (11.3/11.4/11.5) respected._

- [x] [Review][Defer] Mobile content bottom occluded by the fixed BottomNav [`packages/web/src/components/BottomNav.tsx:489`] — deferred, owned by 11.3. Both hunters flagged it High: the fixed `bottom:0; height:62` bar reserves no flex space, so the last ~62px of every scrollable view sits behind it on mobile. This is exactly the documented D6 interim state — 11.3 raises `contentPad` bottom to `104px`. Not a defect in 11.2's scope; confirms the story's "expected, not a bug" note.
- [x] [Review][Defer] ChatWidget FAB overlaps the BottomNav on mobile [`packages/web/src/components/ChatWidget.tsx:394`] — deferred, owned by 11.4. FAB is `fixed; bottom:24; right:24; zIndex:60` (> nav's 55, so no stacking bug) but lands over the rightmost nav tab. `isMobile` is deliberately not passed to `ChatWidget` (App.tsx comment) — chat FAB reposition is 11.4's declared surface.

**Round 2 (2026-07-13, re-run — challenged every round-1 dismissal + deeper edge-case pass):** all 9
round-1 dismissals UPHELD with computed evidence; both round-1 defers confirmed (Edge Hunter refined:
the views' pre-existing `60px` bottom padding is `< 62px + safe-area`, so 11.3's `contentPad`→`104px`
is still required and must be safe-area-aware). One NEW patch surfaced:

- [x] [Review][Patch] **FIXED (2026-07-13):** Community-name span drops the verbatim design's truncation styles [`packages/web/src/components/Header.tsx:66,70`] — AC4 / "paste the design's inline styles verbatim". The design (`Share2Brain Web.dc.html:163-164`) has `min-width:0` on the name wrapper and `overflow:hidden; text-overflow:ellipsis; white-space:nowrap` on the `{communityName}` span; the implementation omitted both. Pre-existing divergence, but 11.2 makes it user-visible: on mobile the new 28px Hexagon + `0 14px` padding shrink the left cluster so a long Discord guild name (up to 100 chars) wraps and overflows the fixed `height:62` header. Fix = restore the two design-verbatim styles (applies on both viewports as the design intends; desktop E2E uses a short name → zero snapshot churn). Independently surfaced by both the Blind Hunter and the Edge Case Hunter in round 2.

**Round 3 (2026-07-13, re-run — validated the R2 patch + scrutinized the desktop path):** the applied
truncation patch is SAFE/SOUND per both hunters — the flex `min-width:0` chain (header → left-cluster →
name-wrapper → span with `overflow:hidden`) is complete so the ellipsis engages on mobile, the Discord
icon is not clipped, and desktop is byte-identical for fitting names (ellipsis/nowrap are no-ops until
overflow). **No new actionable findings.** Four candidates raised and all verified as non-issues:
`--accent-ink` focus-outline token is defined for both themes (`global.css:25,31`, canonical 11.1 token);
no competing CSS `@media` layout breakpoint exists (only `prefers-reduced-motion` — layout is 100%
JS-driven via `useIsMobile` as mandated, so no 760px dead-zone); the BottomNav DOES consume its own
safe-area (`paddingBottom: env(safe-area-inset-bottom,0px)`, `BottomNav.tsx:31`, per AC6); and the
long-name + guest-badge center overlap only manifests below the 360px supported target (contained by the
shell's `overflow:hidden` → AC6 no-h-scroll holds at 360px). Review has converged — R1 dismissals held
under R2 challenge, R2's one patch verified safe under R3.

_Dismissed round 2 (verified non-issues): bottom-nav label has no truncation but the design's bottom-nav item (`Web.dc.html:451`, `mobileNavStyle` L828-831) has none either and the shipped es-ES labels fit at 320px — matching verbatim design is correct; `NAV_ITEMS` import couples BottomNav to the Sidebar module but that is ratified decision D2 (single nav definition for accessible-name parity), not a defect._

_Dismissed round 1 (verified non-issues): Hexagon `EXACT_DOT` has no 28 entry but the proportional fallback yields dot≈5 (matches design 28/16/5); SSR hydration mismatch (pure SPA, AD-3 — no SSR); `<nav>` has no `aria-label` but `Sidebar`'s `<nav>` doesn't either (consistent existing pattern, not a regression); `Header.isMobile` required prop is compile-time only (sole caller passes it); badge has no `99+` cap but neither does the sidebar badge and AC3 mandates verbatim design; `--on-accent` on `#F5A623` is the verbatim sanctioned design value; duplicate `matchMedia` eval in initializer+effect is the intentional idempotent re-sync; `matchMedia` present-but-no-add/removeEventListener and asymmetric add/remove feature-detection are unrealistic environments and mirror the design's own listener shape._
