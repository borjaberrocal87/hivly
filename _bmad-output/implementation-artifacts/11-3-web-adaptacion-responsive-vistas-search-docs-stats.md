---
baseline_commit: 3cd5871442920a1eba220da82950005f12d67289
---

# Story 11.3: web — Adaptación responsive de las vistas (Search / Docs / Stats)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user of the Share2Brain web SPA on a phone or narrow window**,
I want **the Search, Documents and Statistics views to adapt below 760px — reduced content padding that clears the fixed bottom-nav, the Documents table scrolling horizontally inside its own container (never the body), and the Stats grids collapsing to a single column**,
so that **every content screen is fully readable and usable at 360px with no body horizontal scroll and no rows hidden behind the bottom navigation bar (today the views still use the desktop `34px 40px 60px` padding, so their last rows sit behind the 62px bottom-nav)**.

## Story Context

**Third story in Épico 11 (Responsive & Visual Refresh)**, binding sequence `11.1 (done) → 11.2 (done) → **11.3** ∥ 11.4 → 11.5`. It makes the three **content views** responsive on top of the shell that 11.2 delivered. 11.2 built the `useIsMobile` hook + the `AppLayout` sidebar↔bottom-nav switch + `Header` collapse, and **explicitly deferred `contentPad` to this story** (11.2 D6). This story consumes the same `isMobile` boolean, drilling it one level further — `App → AppLayout → {SearchView, DocsView, StatsView}` — and resolves the documented 11.2 interim state.

**This story CLOSES the 11.2 interim gap.** 11.2 left this note (verbatim): *"on mobile the views' bottom padding is still the desktop `60px`, so the last rows sit behind the 62px bottom-nav until 11.3 raises `contentPad` to `104px`."* Two code-review defers (round 1 + round 2) were filed against 11.2 pointing here — the mobile-content-occlusion finding is **owned by this story**. Raising the mobile bottom padding to `104px` (which clears `62px` bottom-nav + `env(safe-area-inset-bottom)` + margin) is AC1 and the primary deliverable.

**Scope boundary (read this — it decides what you do NOT touch):**
- **11.3 (this story):** drill `isMobile` into `SearchView` / `DocsView` / `StatsView`; make each view's `containerStyle` padding dynamic (`contentPad`); align the `DocsView` table `min-width` / first-column to the updated design; verify (and tune only if measurably wrong) the Stats auto-fit grids and Search fluid input; confirm no body horizontal scroll at 360px.
- **11.4 (NOT here):** `ChatWidget` FAB/panel repositioning (`chatBottom`/`chatRight`, `max-width:calc(100vw-32px)`, `kh-pop`). Leave `ChatWidget` untouched — it does not receive `isMobile` until 11.4. Parallelizable with this story.
- **11.5 (NOT here):** the mobile + light-theme E2E harness and new baselines. This story adds **no** new E2E specs and creates **no** new baselines; the existing desktop-dark harness must stay green with **zero baseline churn**.
- **Shell (11.2, DONE — do NOT re-touch):** `AppLayout` sidebar↔bottom-nav switch, `Header` collapse, `BottomNav`, `useIsMobile`, `index.html` `viewport-fit=cover`. You only ADD the three `isMobile={isMobile}` props to the view render calls in `AppLayout.tsx`.

**The mechanism is copied verbatim from the design.** `docs/context/design/Share2Brain Web.dc.html` gives each content screen `padding:{{ contentPad }}` where `contentPad: s.isMobile ? '22px 16px 104px' : '34px 40px 60px'` (L1097). 11.1 already realigned every token name to the design's canonical `--tx*` / `--bg` / `--surface` / `--border` / `--line` / `--track` / `--accent-ink` / `--on-accent` / `--hover-row` / `--border-hover`, so the views already reference the refreshed palette — **the "nueva paleta aplicada" is inherited, not re-authored here**. Your job is layout adaptation + design fidelity, not re-skinning.

## Acceptance Criteria

```gherkin
AC1 — contentPad: each view's padding is dynamic (mobile clears the bottom-nav)
  Given SearchView, DocsView and StatsView each own a scroll container
        (containerStyle: { flex:1, overflowY:'auto', padding:'34px 40px 60px' })
  When each view receives isMobile and renders
  Then on desktop (isMobile false) the container padding is '34px 40px 60px' (byte-identical to today)
   And on mobile (isMobile true) the container padding is '22px 16px 104px' — verbatim design
       (Web.dc.html L1097): the 104px bottom clears the 62px fixed bottom-nav + env(safe-area-inset-bottom)
       + margin, so the last row of scrollable content is no longer occluded (closes 11.2 D6 / the two
       11.2 review defers)
   And nothing else in containerStyle changes (flex:1; overflowY:'auto' stay) — only `padding` is driven
       off isMobile.

AC2 — isMobile is drilled App → AppLayout → views (optional prop, desktop default)
  Given App.tsx already computes `const isMobile = useIsMobile()` (Story 11.2) and drills it to AppLayout
  When AppLayout renders the active view
  Then it passes isMobile={isMobile} to <SearchView>, <DocsView> and <StatsView>
   And each view declares `isMobile?: boolean` defaulting to false (NOT a required prop), so the many
       existing direct-render view tests (render(<SearchView guildId=.../>), render(<StatsView/>), …)
       stay green UNTOUCHED — no existing view-test render call is edited
   And no view calls useIsMobile() itself; the single hook instance in App.tsx is the source of truth
       (mirrors the useTheme / isMobile drilling precedent, one source of truth, prop-testable both ways).

AC3 — DocsView table: horizontal scroll contained in its own box, aligned to the design
  Given the DocsView table (Web.dc.html L278-283)
  When it renders wide content on a narrow viewport
  Then the table wrapper keeps overflowX:'auto' with the border/radius/background box (unchanged from today),
       so wide columns scroll INSIDE that box and NEVER widen the body
   And the header row and the data rows both use grid-template-columns
       'minmax(280px,1fr) 44px 92px 116px 84px' and min-width 720 — aligned to the updated design
       (today's impl is minmax(240px,1fr) / min-width 620; bump the first column 240→280 and the
       min-width 620→720 in BOTH the header grid and the row grid so they stay identical)
   And at 360px the Documents view shows a horizontally scrollable table inside its rounded container with
       NO body horizontal scroll.

AC4 — StatsView grids collapse to one column on mobile via auto-fit (verify; tune only if wrong)
  Given the StatsView KPI grid (repeat(auto-fit,minmax(210px,1fr)), gap 14) and the bottom grid
        (repeat(auto-fit,minmax(300px,1fr)), gap 18, align-items:start) — both already match the design
        (Web.dc.html L343, L373)
  When rendered at 360px (content width ≈ 328px after '22px 16px 104px' padding)
  Then each auto-fit grid collapses to a single column (210 and 300 both fit in one 328px track) with no
       body horizontal scroll
   And the 14-bar activity chart (flex:1 bars, gap 8, height 180) fits the mobile width without overflow
   And no gridTemplateColumns value is changed unless a measured 360px overflow proves one is needed — the
       grids are expected to be correct as-is; this AC is a VERIFY, and any change must be justified in the
       Completion Notes.

AC5 — SearchView stays fluid at 360px (verify)
  Given the SearchView inner column (maxWidth 860, margin '0 auto') and the search input (width 100%,
        height 54, padding '0 18px 0 48px') — Web.dc.html L195, L203
  When rendered at 360px with contentPad '22px 16px 104px'
  Then the input fills the available width (width:100% inside the padded, max-width-860 column), the channel
       filter chips wrap (flex-wrap:wrap, already present), and result cards use overflowWrap:'anywhere'
       (already present) so long content never widens the body
   And no fixed pixel width in SearchView exceeds the 360px content box — this AC is a VERIFY; change a value
       only if a measured overflow proves it, and justify it.

AC6 — Usable at 360px; body never scrolls horizontally
  Given the app rendered at 360px width in BOTH themes (data-kh dark + light)
  When the user navigates Search, Documents and Statistics
  Then the document body does not scroll horizontally on any of the three views (the shell stays
       width:100vw; overflow:hidden from 11.2; every wide element is either fluid or contained in its own
       overflow-x box)
   And the last row of each scrollable view is fully visible above the fixed 62px bottom-nav (contentPad
       bottom 104px), in both themes.

AC7 — No desktop regression; existing unit + e2e stay green UNTOUCHED
  Given the whole existing test suite (Vitest unit incl. App.test.tsx + the three view specs; Playwright
        desktop harness) runs WITHOUT stubbing matchMedia in test-setup.ts
  When it runs after the change
  Then every existing assertion passes UNCHANGED, because jsdom has no window.matchMedia → useIsMobile
       returns false → isMobile flows as false → the views render with the desktop '34px 40px 60px' padding
       and desktop grids exactly as today
   And the Playwright 'chromium' project uses devices['Desktop Chrome'] (1280px > 760px) so the existing
       e2e run desktop and every baseline snapshot is byte-identical (zero churn)
   And any new/changed unit test is limited to focused responsive assertions in the three view specs
       (padding differs mobile vs desktop; DocsView table min-width/first-col value); no existing spec's
       assertions are edited.

AC8 — Verification gate green; frontend-only; invariants intact
  Given the mandatory gate
  When "npm run lint && npm run test && npm run build" runs (agent runs it, pastes output)
  Then all pass with no red, and the E2E desktop harness passes with zero baseline churn
   And the diff touches packages/web ONLY — zero change to shared, backend, workers, bot, the Drizzle
       schema, any Zod contract, or any API/SSE shape (AD-3 + AD-6 intact)
   And NO new runtime dependency is added, and no @media layout breakpoint is introduced (layout stays
       JS-driven via the existing useIsMobile hook — consistent with 11.2 and the design).
```

## Tasks / Subtasks

- [x] **Task 1 — Drill `isMobile` from `AppLayout` into the three views (AC2)**
  - [x] In `AppLayout.tsx`, add `isMobile={isMobile}` to each of the three view render calls (`<SearchView guildId=… />`, `<DocsView … />`, `<StatsView />`) at AppLayout.tsx:89-95. `AppLayout` already receives `isMobile` (11.2) — no new prop on `AppLayout` itself, and do NOT touch the `isMobile ? <BottomNav/> : <Sidebar/>` switch or the `<Header isMobile>` wiring.
  - [x] Do **not** call `useIsMobile()` inside any view. One hook instance in `App.tsx` remains the single source of truth.

- [x] **Task 2 — `SearchView` responsive padding (AC1, AC2, AC5)**
  - [x] Add `isMobile?: boolean` to `SearchViewProps` (default `false`). SearchView keeps `guildId`.
  - [x] `containerStyle` (SearchView.tsx:26) currently holds a hardcoded `padding: '34px 40px 60px'`. Make padding dynamic at the render site: `<div style={{ ...containerStyle, padding: isMobile ? '22px 16px 104px' : '34px 40px 60px' }}>` (SearchView.tsx:92). Keep `flex:1; overflowY:'auto'` from the const. (Either keep `padding` in the const and override via spread, or drop it from the const and always compute — pick the smaller diff; spread-override is fine.)
  - [x] AC5 is a VERIFY: `innerStyle.maxWidth` stays 860 with `margin:'0 auto'`; the input stays `width:'100%'`; filter chips stay `flexWrap:'wrap'`; result cards keep `overflowWrap:'anywhere'`. Change nothing unless a measured 360px overflow proves it.

- [x] **Task 3 — `DocsView` responsive padding + table alignment (AC1, AC2, AC3)**
  - [x] Add `isMobile?: boolean` to `DocsViewProps` (default `false`). DocsView keeps `unreadCounts` + `onUnreadChange`.
  - [x] Make `containerStyle` (DocsView.tsx:29) padding dynamic the same way as SearchView, at the render site (DocsView.tsx:166).
  - [x] Align the table to the updated design in **both** grid definitions (header at DocsView.tsx:311 and row at DocsView.tsx:432): `gridTemplateColumns: 'minmax(280px,1fr) 44px 92px 116px 84px'` (240→280) and `minWidth: 720` (620→720). The two grids MUST stay identical to each other and to the design (Web.dc.html L279, L283).
  - [x] Confirm the table wrapper (DocsView.tsx:302) keeps `overflowX:'auto'` with its border/radius/background box — this is the contained horizontal scroll; do NOT move overflow-x to the body or remove the box.

- [x] **Task 4 — `StatsView` responsive padding + grid verify (AC1, AC2, AC4)**
  - [x] Add `isMobile?: boolean` to StatsView props (StatsView renders `<StatsView />` today — introduce a small `StatsViewProps { isMobile?: boolean }`, default `false`).
  - [x] Make `containerStyle` (StatsView.tsx:18) padding dynamic the same way, at the render site (StatsView.tsx:114).
  - [x] VERIFY the auto-fit grids already match the design: KPI grid `repeat(auto-fit,minmax(210px,1fr))` gap 14 (StatsView.tsx:174-175); bottom grid `repeat(auto-fit,minmax(300px,1fr))` gap 18 align-items:start (StatsView.tsx:151-152). They should be correct as-is — do NOT change a `gridTemplateColumns` value unless a measured 360px overflow proves it, and if you do, justify it in Completion Notes.
  - [x] VERIFY the 14-bar activity chart (flex:1 bars, gap 8, height 180) fits at 360px without overflow.

- [x] **Task 5 — Palette / raw-hex sanity (AC6)**
  - [x] No new work on tokens — 11.1 already refreshed `global.css`/`components.css` and the views reference tokens. VERIFY the three views contain no raw hex outside the sanctioned allowlist: only `#F5A623` (amber), `#5865F2` (Discord blurple), `#3BA55D` (green check), `#FFCB6B` (amber gradient stop) and the `rgba(245,166,35,…)` amber tints may appear — all pre-existing, all sanctioned. Do not introduce any new raw hex.

- [x] **Task 6 — Tests (AC1, AC3, AC7)**
  - [x] Add focused responsive assertions to each of the three existing view specs (do NOT create new spec files, do NOT edit existing assertions):
    - `SearchView.test.tsx`: render with `isMobile` true and false; assert the scroll container's `padding` is `'22px 16px 104px'` vs `'34px 40px 60px'` (query the `data-screen-label`-equivalent container or the outermost view div).
    - `DocsView.test.tsx`: same padding assertion both ways; plus assert the table header/row grid uses `min-width: 720px` (and/or `minmax(280px,1fr)`) — pick a stable selector already used by the existing DocsView tests.
    - `StatsView.test.tsx`: same padding assertion both ways.
  - [x] Keep the default-false path proven: a render **without** `isMobile` must still produce the desktop `'34px 40px 60px'` padding (this is what keeps the existing tests green — assert it once).
  - [x] Do **not** add a `matchMedia` stub to `test-setup.ts`. Do **not** edit any existing assertion in `App.test.tsx` or the three view specs — verify they stay green untouched.

- [x] **Task 7 — Verification gate + docs sync (AC7, AC8)**
  - [x] Run `npm run lint && npm run test && npm run build` (repo-wide) — paste output. Never commit red.
  - [x] Run the E2E desktop harness (`test:e2e`, Chromium, dark, 1280px) — expect the existing count **passed, zero baseline churn**. If any snapshot diffs, a desktop value moved by mistake — stop and audit (the DocsView table min-width bump is desktop-visible only if the table was previously narrower than 720px on the desktop viewport; at 1280px with max-width 980 the wrapper is ~900px wide < 720? no, 900 > 720 so min-width never engages on desktop → no visual change → zero churn; confirm this reasoning against the baseline).
  - [x] Confirm `git diff --name-only 3cd5871 -- packages/` is `web` only.
  - [x] No `TECHNICAL-DESIGN.md` / `frontend-standards.md` change needed — both were updated when Épico 11 was planned (frontend-standards.md responsive rule, TECHNICAL-DESIGN §5.5 responsive paragraph). Leave them.

## Dev Notes

### The one job of `isMobile` in the views is `contentPad` (AC1)

Unlike the shell (11.2), the views need `isMobile` for exactly **one** thing: the container padding. Search's input is already `width:100%`, Docs' table already scrolls inside an `overflow-x` box, and Stats' grids are already `auto-fit` (they collapse without a breakpoint). So the responsive surface here is small and mechanical: drill the prop, override `padding`, align the one table divergence, verify the rest. Resist scope creep — do not add mobile-specific font sizes, hide columns, or restructure any view. The design does none of that; it only changes `contentPad`.

[Source: docs/context/design/Share2Brain Web.dc.html L194/L256/L338 (all three screens are `flex:1; overflow-y:auto; padding:{{contentPad}}`), L1097 (`contentPad` definition); packages/web/src/components/{SearchView,DocsView,StatsView}.tsx]

### Why `isMobile?` is OPTIONAL with a `false` default (D1) — the AC7 linchpin

The existing view tests render the views **directly** and repeatedly: `render(<SearchView guildId={GUILD_ID} />)` appears ~10× in `SearchView.test.tsx`, `render(<StatsView />)` in `StatsView.test.tsx`, and `DocsView.test.tsx` renders `<DocsView …>` many times — none pass `isMobile`. If `isMobile` were a **required** prop, every one of those render calls would break (TS compile error + runtime), forcing edits across three spec files. Making the prop **optional, default `false`** (desktop) keeps all existing view-test render calls green **untouched**, matches the jsdom desktop default, and still lets the new focused tests pass `isMobile` explicitly to exercise both paths.

This is a deliberate divergence from 11.2, where `Header.isMobile` / `BottomNav` props are **required** — but there the sole caller was `AppLayout` (one call site), so required was cheap. Here the callers are dozens of test render sites, so optional-default-false is the low-churn, low-risk choice. Flagged as D1 (reversible).

[Source: packages/web/src/components/SearchView.test.tsx:69-180 (10 direct renders); StatsView.test.tsx:64; DocsView.test.tsx]

### The jsdom `matchMedia` guard (inherited from 11.2) still protects everything

`test-setup.ts` does **not** stub `matchMedia`; jsdom has none; `useIsMobile` returns `false` under jsdom (11.2's guard). `App.tsx` → `AppLayout` → views therefore all see `isMobile=false` in the full App-level tests, so the desktop padding + desktop grids render and every existing assertion holds. The new view-level tests pass `isMobile` explicitly (the prop is drilled → trivially testable both ways), so they do not depend on `matchMedia` at all. Do not add a `matchMedia` stub to `test-setup.ts` — it would flip the desktop default and churn the suite.

[Source: _bmad-output/implementation-artifacts/11-2-web-useismobile-shell-responsive-applayout-header.md#THE-critical-guardrail; packages/web/src/test-setup.ts]

### Closing the 11.2 interim state (D6 + the two 11.2 review defers)

11.2 shipped the bottom-nav but left the views' desktop `60px` bottom padding, so on mobile the last ~62px of every scrollable view sits behind the fixed bar. Both the Blind Hunter and the Edge Case Hunter filed this **High** in the 11.2 review and deferred it here (round 2 Edge Hunter refined: the `60px` is `< 62px + safe-area`, so `104px` is required **and** the safe-area is already handled by the bottom-nav's own `padding-bottom:env(safe-area-inset-bottom)`). The design's `104px` = 62 (bar) + a margin + headroom over the inset; use the verbatim `'22px 16px 104px'` — do not compute it dynamically or subtract the inset (the bar already reserves the inset; the 104px sits above the bar's top edge).

[Source: 11-2…md#Review-Findings (2 defers: BottomNav.tsx:489, and the round-2 refinement); Web.dc.html L1097]

### DocsView table divergence to reconcile (AC3) — the ONLY design-value change in this story

Today's `DocsView` table uses `minmax(240px,1fr) … / min-width:620` in both the header and row grids; the **updated** design uses `minmax(280px,1fr) … / min-width:720` (Web.dc.html L279, L283). The other four columns (44/92/116/84) and gap (12) already match. Bump the first column and min-width in **both** grids so they stay identical to each other. Rationale for it being safe on desktop: at the 1280px desktop viewport the Documents view's inner column is `max-width:980`, so the table wrapper is ≈900px wide — wider than 720 — meaning `min-width:720` never engages and the columns lay out by the `minmax(…,1fr)` free track exactly as before → **no desktop visual change → zero e2e baseline churn**. `min-width:720` only matters below ~720px, i.e. mobile, where it now correctly triggers the contained horizontal scroll. Verify this against the baseline before declaring AC7.

[Source: Web.dc.html L279/L283; packages/web/src/components/DocsView.tsx:311,432 (current 240/620)]

### Stats grids are already correct — this is a VERIFY, not a rebuild (AC4)

The current `StatsView` KPI grid (`repeat(auto-fit,minmax(210px,1fr))`) and bottom grid (`repeat(auto-fit,minmax(300px,1fr))`) already match the design (L343, L373) byte-for-byte, including the gaps (14 / 18) and `align-items:start`. `auto-fit` collapses to one column with no breakpoint when the track can't fit two columns — so at 360px (content ≈328px) both grids become single-column automatically. **Do not "fix" them.** Only if a real 360px overflow is measured (it should not be) may a value change, and it must be documented. The activity bar chart (14 × `flex:1`, gap 8) also fits — verify, don't touch.

[Source: Web.dc.html L343,L373; packages/web/src/components/StatsView.tsx:151-152,174-175]

### Current view state (what you are modifying) — exact state today

- **`SearchView.tsx`**: `const containerStyle = { flex:1, overflowY:'auto', padding:'34px 40px 60px' }` (L26), `innerStyle = { maxWidth:860, margin:'0 auto' }` (L27), rendered at L92. Props: `{ guildId: string }`. Input `width:100%` height 54; filter chips `flex-wrap:wrap`; result cards `overflowWrap:'anywhere'`. Fully fluid already.
- **`DocsView.tsx`**: same `containerStyle` (L29), `innerStyle = { maxWidth:980 }` (L30), rendered at L166. Props: `{ unreadCounts, onUnreadChange }`. Table wrapper `overflowX:'auto'` (L302) wrapping header grid (L310, `minmax(240px,1fr) … min-width:620`) and row grid (L431, same). Author/date/desc all already have `overflow:hidden`/`text-overflow:ellipsis`/`overflowWrap:'anywhere'` where needed.
- **`StatsView.tsx`**: same `containerStyle` (L18), `innerStyle = { maxWidth:1040 }` (L19), rendered at L114. No props today (`<StatsView />`). KPI grid L174-175, bottom grid L151-152, activity chart bars, channel bars, coverage donut — all token-driven.
- **`AppLayout.tsx`** (99 lines): receives `isMobile` (11.2), renders `{isMobile ? <BottomNav/> : <Sidebar/>}` + `<Header isMobile … />` + the view ternary at L89-95. You add `isMobile={isMobile}` to the three view calls only.

[Source: packages/web/src/components/{SearchView,DocsView,StatsView,AppLayout}.tsx]

### Decisions (ratified defaults — flag at PR)

- **D1 — `isMobile?: boolean` OPTIONAL, default `false` on all three views** (not required as in 11.2). Keeps ~dozens of existing direct-render view-test call sites green untouched, matches the jsdom desktop default, and stays prop-testable both ways. Reversible (make it required + edit the tests if a stricter contract is ever wanted). See "Why isMobile? is OPTIONAL" above.
- **D2 — `contentPad` overridden via inline spread over the const `containerStyle`**, computed off `isMobile` at the render site (`{ ...containerStyle, padding: isMobile ? '22px 16px 104px' : '34px 40px 60px' }`). Mirrors the 11.2 `Header` dynamic-padding pattern (padding is not a pseudo-class property → inline is safe, no cascade trap). Reversible.
- **D3 — DocsView table aligned to the design's `minmax(280px,1fr)` / `min-width:720`** (from today's 240/620), in both header and row grids. Faithful to the updated design; proven desktop-safe (min-width never engages at the 980-max-width desktop table) → zero e2e churn. Reversible only by diverging from the design (not recommended).
- **D4 — Stats grids and Search input LEFT AS-IS (verify-only)**, because they already match the design and auto-fit/`width:100%` handle mobile without a breakpoint. Any change requires a measured-overflow justification in Completion Notes.
- **D5 — `104px` mobile bottom padding used verbatim, not computed from the safe-area inset.** The bottom-nav already reserves `env(safe-area-inset-bottom)` via its own `padding-bottom` (11.2 AC6); `104px` is the design's headroom above the bar's top edge. Do not subtract or re-add the inset in the views.

### Architecture & guardrails

- **Frontend-only, `packages/web` exclusively.** AD-3 (static SPA — responsiveness is pure client CSS/JS, no server, no per-device build) and AD-6 (no contract touched) stay intact. No Drizzle/Zod/API/SSE change. **No new dependency** (reuses the 11.2 `useIsMobile`). No DDL, no migration. [Source: epics.md#Épico-11; sprint-change-proposal-2026-07-13-responsive-refresh.md#2]
- **No `@media` layout breakpoint.** Layout stays JS-driven via `useIsMobile` (the house pattern established in 11.2, consistent with the design's `isMobile`-in-state approach). The only `@media` in the package remains `prefers-reduced-motion`. [Source: 11-2…md#Project-Structure-Notes; components.css]
- **No raw hex outside the allowlist.** Only the pre-existing sanctioned hexes (`#F5A623`, `#5865F2`, `#3BA55D`, `#FFCB6B`, `rgba(245,166,35,…)`) may appear; introduce none. Everything else references tokens. [Source: global.css allowlist; 11-1 token realignment]
- **English only** in all code/comments/tests/commits. [Source: project-context.md#Code quality]
- **One story at a time; branch first.** `git switch -c feat/11-3-responsive-views` off HEAD (`3cd5871`); never commit on `main`. Conventional Commits, scope `web`. This story is parallelizable with 11.4 but they touch disjoint files (views vs `ChatWidget`). [Source: project-context.md#Development workflow]

### Project Structure Notes

- Components live in `packages/web/src/components/` (there is **no** `views/` dir despite the epic's "vistas" prose). Files touched: `AppLayout.tsx` (add 3 props), `SearchView.tsx`, `DocsView.tsx`, `StatsView.tsx`, and the three co-located `*.test.tsx`. No new files.
- Layout values live **inline** in each component's `CSSProperties`; only interactive `:hover`/`:focus` states live in `components.css`. This story adds JS-driven responsive padding (consistent with 11.2). Do not introduce `@media` layout rules.
- `data-kh` (theme) is orthogonal to layout — the views theme automatically via tokens in both light and dark; AC6 requires verifying both, but no theme-specific code.

### Testing

- **Unit (Vitest + RTL):** focused responsive assertions added to the three existing view specs (padding mobile vs desktop; DocsView table min-width/first-col). All other unit tests — App.test.tsx and the untouched view assertions — stay green because the default-false prop + jsdom matchMedia guard preserve the desktop path. Do not create new spec files; do not edit existing assertions. [Source: 11-2…md#Testing; project-context.md#Testing]
- **E2E visual (Playwright, existing dark-desktop harness):** `chromium` = `devices['Desktop Chrome']` (1280px > 760px) → desktop path → existing count passed, **zero baseline churn**. The DocsView 720/280 bump is desktop-invisible (min-width doesn't engage at the 980-max table). Any snapshot diff means a desktop value moved by accident — stop and audit. Mobile + light-theme baselines are **11.5's** job, deferred by name. [Source: playwright.config.ts; epics.md#Historia-11.5]
- **No integration run needed** (web-only, no shared/backend touch) — mirrors 9.2/10.2/11.1/11.2.
- **E2E boot note (from 11.1/11.2):** `e2e:server` needs `DATABASE_URL` + `REDIS_URL` (no default). Local: `DATABASE_URL` → Docker Postgres :5432, `REDIS_URL=redis://127.0.0.1:6379` (tests/README.md).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Épico-11 · Historia-11.3] — story scope, binding sequence (11.3 ∥ 11.4 after 11.2), FR27, "usable at 360px, no body h-scroll".
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-responsive-refresh.md] — Moderate, AD-3/AD-6 intact, frontend-only, no new dependency, risk Low; §4 success criteria.
- [Source: docs/context/design/Share2Brain Web.dc.html] — L194/L256/L338 (three screens use `padding:{{contentPad}}`), L1097 (`contentPad: isMobile ? '22px 16px 104px' : '34px 40px 60px'`), L278-283 (Docs table `overflow-x:auto`, `minmax(280px,1fr) … min-width:720`), L343 (KPI grid `minmax(210px,1fr)`), L373 (bottom grid `minmax(300px,1fr)`), L195/L203 (Search inner max-width 860 + input width 100%).
- [Source: _bmad-output/implementation-artifacts/11-2-web-useismobile-shell-responsive-applayout-header.md] — the shell this builds on: `useIsMobile`, `AppLayout` switch, `Header` collapse, `viewport-fit=cover`; D6 (contentPad deferred here); the two review defers pointing here; the jsdom matchMedia guardrail.
- [Source: _bmad-output/implementation-artifacts/11-1-web-refresh-design-tokens-estados-interaccion.md] — refreshed `--tx*`/`--surface`/`--border`/`--line`/`--track`/`--hover-row`/`--border-hover`/`--accent-ink`/`--on-accent` tokens the views already consume; raw-hex allowlist; components.css cascade rule.
- [Source: packages/web/src/components/{AppLayout,SearchView,DocsView,StatsView}.tsx + the three *.test.tsx; App.tsx; hooks/useIsMobile.ts; test-setup.ts; playwright.config.ts] — current view state, wiring, tests, config.
- [Source: docs/frontend-standards.md#UI/UX-Standards] — 760px breakpoint, no body h-scroll, wide content scrolls inside its own overflow-x container, mobile+light E2E rule.
- [Source: docs/context/TECHNICAL-DESIGN.md §5.5] — Responsive (Épico 11) paragraph.
- [Source: docs/context/ARCHITECTURE-SPINE.md] — AD-3 (static SPA), AD-6 (contracts in shared).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story).

### Debug Log References

- First `vitest run` of the three view specs: the new DocsView table-grid assertion caught that
  the row grid was NOT bumped (`expected '620px' to be '720px'`). Root cause: the two grid blocks
  have different indentation (header nested deeper inside JSX than the `DocRow` row grid), so the
  first `replace_all` only matched the header block. Fixed by editing the row grid separately; a
  follow-up grep confirmed both grids now read `minmax(280px,1fr)` / `minWidth: 720`.

### Completion Notes List

- **AC1 — dynamic `contentPad` (primary deliverable, closes 11.2 D6 + both 11.2 review defers).**
  Each view's outer scroll container now spreads `containerStyle` and overrides only `padding`:
  `{ ...containerStyle, padding: isMobile ? '22px 16px 104px' : '34px 40px 60px' }` (D2). `flex:1` /
  `overflowY:'auto'` are untouched. `104px` used verbatim (D5) — not computed from the safe-area
  inset (the bottom-nav already reserves `env(safe-area-inset-bottom)` per 11.2 AC6).
- **AC2 — prop drilling, optional default-false (D1).** `AppLayout.tsx` passes `isMobile={isMobile}`
  to `<SearchView>`, `<DocsView>` and `<StatsView>`. Each view declares `isMobile?: boolean`
  defaulting to `false`; no view calls `useIsMobile()` (App.tsx stays the single source of truth).
  Optional-default-false keeps every existing direct-render view-test call site green untouched —
  1088 unit+web tests pass (+7 new: 2 padding assertions × 3 views + 1 DocsView grid assertion; the
  SearchView/Stats/Docs padding pairs each also prove the default-false desktop path).
- **AC3 — DocsView table aligned to the updated design (D3, the ONLY design-value change).** Both the
  header grid (`DocsView.tsx:315/317`) and the row grid (`:436/:438`) now use
  `gridTemplateColumns: 'minmax(280px,1fr) 44px 92px 116px 84px'` and `minWidth: 720` (from 240/620).
  The `overflowX:'auto'` bordered/rounded wrapper is unchanged — wide columns scroll inside the box,
  never widening the body. New test asserts BOTH grids read `min-width 720px` + `280px` first column.
- **AC4 — Stats grids: VERIFY only, NO change (D4).** KPI grid `repeat(auto-fit,minmax(210px,1fr))`
  and bottom grid `repeat(auto-fit,minmax(300px,1fr))` left as-is; auto-fit collapses to one column at
  360px without a breakpoint. No measured overflow → no `gridTemplateColumns` change.
- **AC5 — Search input: VERIFY only, NO change (D4).** `innerStyle.maxWidth` 860 / `margin:'0 auto'`,
  input `width:'100%'`, chips `flexWrap:'wrap'`, cards `overflowWrap:'anywhere'` all already fluid.
- **AC6 / AC7 — no desktop regression, zero baseline churn.** Full E2E desktop harness (Chromium,
  `Desktop Chrome` 1280px, dark) = **28 passed, zero baseline churn** — confirming the 720/280 bump is
  desktop-invisible (the Documents table wrapper is ≈900px at the 980-max desktop viewport, so
  `min-width:720` never engages). `docs.spec.ts:32` grid test passed unchanged.
- **AC8 — gate + guardrails.** `npm run lint && npm run test && npm run build` all green.
  `git diff --name-only 3cd5871 -- packages/` = `web` ONLY (4 source + 3 test files). No shared/
  backend/workers/bot, no Drizzle schema, no Zod contract, no API/SSE shape (AD-3 + AD-6 intact). No
  new runtime dependency; no `@media` layout breakpoint (layout stays JS-driven via `useIsMobile`).
- **Task 5 — raw-hex sanity.** Grepped the three views: every raw hex is pre-existing and sanctioned
  (amber `#F5A623`/`#FFCB6B`, green `#3BA55D`, blurple `#5865F2`/`#8891F5`, the D4 avatar palette,
  `#fff` avatar text). This diff introduces **zero** new raw hex.

### File List

- `packages/web/src/components/AppLayout.tsx` — drill `isMobile` into the 3 view render calls (AC2).
- `packages/web/src/components/SearchView.tsx` — `isMobile?` prop (default false) + dynamic padding (AC1).
- `packages/web/src/components/DocsView.tsx` — `isMobile?` prop + dynamic padding + table grid 280/720 (AC1, AC3).
- `packages/web/src/components/StatsView.tsx` — `StatsViewProps { isMobile? }` + dynamic padding (AC1).
- `packages/web/src/components/SearchView.test.tsx` — +2 responsive padding assertions (AC1, AC2).
- `packages/web/src/components/DocsView.test.tsx` — +2 padding assertions + 1 table-grid alignment assertion (AC1, AC3).
- `packages/web/src/components/StatsView.test.tsx` — +2 responsive padding assertions (AC1, AC2).

### Change Log

- 2026-07-13 — Story 11.3 implemented: responsive adaptation of the Search/Docs/Stats views. Drilled
  the optional `isMobile` prop App→AppLayout→views, made each view's `contentPad` dynamic
  (`22px 16px 104px` mobile / `34px 40px 60px` desktop), aligned the DocsView table to the updated
  design (`minmax(280px,1fr)` / `min-width:720` in both grids), verified the Stats auto-fit grids and
  Search fluid input need no change. Frontend-only (`packages/web`), no new dependency, no `@media`.
  Gate green: lint 0 / 1088 unit+web / build 5 pkgs / 28 e2e desktop with zero baseline churn.

### Review Findings

_bmad-code-review 2026-07-13 — 3 layers @ Opus 4.8 (Blind Hunter / Edge Case Hunter / Acceptance Auditor). Acceptance Auditor: all 8 ACs SATISFIED, Completion Notes truthful. 0 decision-needed, 3 patch, 1 defer, 4 dismissed. No HIGH/MEDIUM correctness defects._

_Round 2 (re-review of the patched diff) — CONVERGED, 0 new actionable findings. Auditor: all 8 ACs still SATISFIED, the 3 round-1 fixes introduced no regression and no scope creep, and every "FIXED" claim below is truthful against the code. Edge: no unhandled edge cases (verified no path reads the removed `containerStyle.padding`; the grid test cannot pass vacuously; the AppLayout spy test fails hard if drilling regresses). Blind: 0 High/Med, 2 Low observations both self-marked non-bugs (test-name scope nuance; asymmetric `toHaveBeenCalled`). 4 dismissed as noise/cosmetic. No code change in round 2 → gate not re-run._

- [x] [Review][Patch] Strengthen DocsView grid test — `toContain('280px')` is a loose substring (also passes for `1280px`) and the test never asserts header/row `gridTemplateColumns` equality, so the header↔row sync that D3 mandates isn't actually guarded (a drift in one of the four fixed tracks stays green) [packages/web/src/components/DocsView.test.tsx:56-60] (blind+edge) — FIXED: anchors the full template via regex `/minmax\(280px,\s*1fr\)\s+44px\s+92px\s+116px\s+84px/` and asserts `row.gridTemplateColumns === header.gridTemplateColumns` + equal `min-width`.
- [x] [Review][Patch] Dead `padding` in the three `containerStyle` consts — always overridden by the render-site ternary, so the desktop literal `'34px 40px 60px'` lives in two places and can silently drift (D2 explicitly sanctions dropping it from the const) [packages/web/src/components/SearchView.tsx:32, DocsView.tsx:35, StatsView.tsx:105] (blind+edge) — FIXED: `padding` removed from all three consts; the render-site ternary is now the single source of truth (rendered output byte-identical → zero e2e churn).
- [x] [Review][Patch] No test that AppLayout forwards `isMobile` to the three views — the view specs render each view directly, so dropping `isMobile={isMobile}` from an AppLayout call site would break the feature while every test stays green [packages/web/src/components/AppLayout.tsx:89-95] (blind) — FIXED: view mocks converted to `vi.hoisted` spies; new parametrized test asserts each of `<SearchView>`/`<DocsView>`/`<StatsView>` receives `isMobile` (true and false).
- [x] [Review][Defer] StatsView bottom grid (`repeat(auto-fit,minmax(300px,1fr))`) overflows its own container below ~312px viewport with no in-box `overflow-x` (unlike DocsView's wrapped table) [packages/web/src/components/StatsView.tsx:161] — deferred, pre-existing (grid unchanged by this story; above the story's stated 360px floor the 300px track fits with content ≈328px)
