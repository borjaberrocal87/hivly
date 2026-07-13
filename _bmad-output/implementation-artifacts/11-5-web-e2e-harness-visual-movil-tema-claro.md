---
baseline_commit: 2d4cab45e90795eda37298260e81e87aa71f5be2
---

# Story 11.5: web/e2e — Extender el harness visual a móvil + tema claro

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the **share2brain web team**,
I want the Playwright computed-style e2e harness to also exercise a **mobile viewport (≤760px, 390×844)** and the **light theme** — not just the current desktop×dark — with anchor assertions for login, search, docs, stats and chat across the combinations **mobile×dark, mobile×light and desktop×light**,
so that Epic 11's responsive shell (bottom-nav, header compaction, adaptive padding) and the light-theme token set are **regression-locked by the real cascade** (`getComputedStyle` on the built SPA), the same way desktop×dark already is.

## Context & precedent

- Epic 11 (`epics.md` §"Épico 11", Historia 11.5): _"Añadir un viewport móvil (≤760px, p.ej. 390×844) y una ejecución en tema **claro** además del desktop/oscuro actual; baselines nuevas para login, search, docs, stats y chat en las combinaciones móvil×claro/oscuro y desktop×claro. Suite verde. Depende de 11.1–11.4."_ Approved via `sprint-change-proposal-2026-07-13-responsive-refresh.md` (classification Moderate). Sequence binding: 11.1 → 11.2 → (11.3 ∥ 11.4) → **11.5** (closes the epic).
- **Terminology — "baselines" here means computed-style anchor assertions, NOT pixel screenshots.** This harness (landed Story 4.5) verifies the real CSS by asserting `getComputedStyle` values (rgb/px) with Playwright's `toHaveCSS`; it has **zero** `toHaveScreenshot`/image-baseline usage. `.png` files under `test-results/` are only failure/full-page artifacts (gitignored) — they are not committed comparison baselines. Do **not** introduce `toHaveScreenshot` in this story; extend the computed-style pattern. [Source: `packages/web/tests/README.md`; `packages/web/playwright.config.ts` L27–32 `screenshot: 'only-on-failure'`]
- Frontend/e2e-only. **AD-3** (static SPA) and **AD-6** (contracts only in `shared`) stay intact: no `shared`/`backend`/`workers`/`bot` change, no Drizzle/Zod/API/SSE touch, no new runtime dependency, no `@media` layout rule, no `@keyframes`. The layout is 100% JS-driven via `useIsMobile` (`window.matchMedia('(max-width: 760px)')`); the only production `@media` is `prefers-reduced-motion`. [Source: `_bmad-output/project-context.md` §Frontend rules; `packages/web/src/hooks/useIsMobile.ts`]

## Acceptance Criteria

**AC1 — Harness parametrization (theme) with zero regression to the existing desktop×dark suite.**
```gherkin
Given the current harness forces the dark theme inside loginAs and runs one chromium
  "Desktop Chrome" (1280px) project
When the theme becomes a parameter of the session helper (default 'dark')
  and the light-theme / mobile combinations are added as NEW spec files
Then every existing spec (analytics, auth-guest, chat, docs, interactions, search)
  runs unchanged — no existing assertion edited — and the pre-11.5 e2e baseline
  (28 passing tests, verified in Story 11.4) stays green byte-for-byte
  And the desktop×dark project/config continues to force dark for all pre-existing specs.
```

**AC2 — Mobile shell anchors (390×844), all views.**
```gherkin
Given an authenticated member session at viewport 390×844
When the SPA renders
Then the BottomNav is present (nav is position:fixed, bottom:0px, height:62px,
  three ".kh-bottom-nav-item" buttons, background-color = --bg-deep, border-top-color
  = --line) and the Sidebar is ABSENT from the DOM (".kh-nav-item" count is 0)
  And the active bottom-nav item color = --accent-ink and carries aria-current="page"
  And the "bottom-nav-badge" shows the seeded member's unread-docs count
  And the Header padding is "0px 14px", the hexagon logo is present, and the
  statsLine, the "live-pulse" pill and the username span are all ABSENT.
```

**AC3 — Chat widget mobile geometry (390×844).**
```gherkin
Given an authenticated member session at viewport 390×844
When the chat FAB ("chat-fab") is shown and then opened
Then the FAB has bottom:78px and right:16px (vs 24px/24px on desktop)
  And the open panel ("chat-panel") has bottom:78px and right:16px
  And the panel's width (404px), height (642px), max-width (calc(100vw - 32px) →
  resolves to 358px at 390px wide) and max-height (calc(100vh - 48px)) are the
  design values, unchanged from desktop
  And the FAB bottom clears the 62px bottom-nav (78 > 62).
```

**AC4 — Light-theme token anchors, all views + login screen.**
```gherkin
Given the theme is set to light (data-kh="light") before first paint
When each view is rendered
Then computed colors resolve to the light token set, verified on at least one
  visible element per view:
  | surface                        | token           | light rgb            |
  | Header background              | --bg            | rgb(244, 245, 247)   |
  | Body/view text                 | --tx            | rgb(27, 31, 39)      |
  | Result / KPI card background   | --card          | rgb(255, 255, 255)   |
  | BottomNav bar background       | --bg-deep       | rgb(236, 238, 241)   |
  | Active bottom-nav / focus ring | --accent-ink    | rgb(154, 91, 0)      |
  | Chat panel border              | --border-strong | rgb(211, 216, 223)   |
  And the login screen (pre-auth, "guest-login-btn" reachable) renders in light theme.
```

**AC5 — Combination matrix coverage.**
```gherkin
Given the three new combinations mobile×dark, mobile×light and desktop×light
When the new spec(s) run
Then each of login, search, docs, stats and chat is exercised in each applicable
  combination, asserting the combination-defining computed anchors (layout anchors
  for mobile per AC2/AC3; token anchors for light per AC4) — NOT a full re-assertion
  of the desktop×dark value set
  And the new specs are strictly NON-MUTATING (login + view/chat-panel open only;
  no chat message sent, no doc-row marked read, no mark-all) so the seed-order
  invariant in tests/README.md is preserved.
```

**AC6 — Full verification gate green, frontend/e2e-only.**
```gherkin
Given the change is complete
When the agent runs the mandatory gate
Then "npm run lint" is 0/0, "npm run test" (vitest unit+web) passes with no new
  failures, "npm run build" is clean for all 5 packages
  And "npm run test:e2e -w @share2brain/web" passes: the pre-existing 28 tests plus
  the new combination tests, all green, with zero churn to existing spec assertions
  And the diff touches only packages/web/tests/** (+ optionally packages/web/
  playwright.config.ts and a minimal loginAs signature change) — no shared/backend/
  workers/bot change, no Drizzle/Zod/API/SSE touch, no new dependency.
```

## Tasks / Subtasks

- [x] **Task 1 — Parametrize the session helper by theme (AC1)**
  - [x] In `packages/web/tests/helpers/session.ts`, add an optional `theme: 'dark' | 'light'` parameter to `loginAs` (and, if a light login-screen test needs it, expose the same for the pre-auth path). Default **`'dark'`** so all existing callers (`loginAs(page)`, `loginAs(page, 'e2e-empty')`) are byte-identical.
  - [x] Replace the hard-coded `localStorage.setItem('share2brain-theme', 'dark')` init script with the parameter value. The `index.html` blocking script reads this into `data-kh` before first paint (FOUC-free) — keep that contract.
  - [x] Do **not** change `loginAsGuest`'s behavior for existing specs (keep dark default); only widen if a guest light/mobile anchor is actually asserted.
- [x] **Task 2 — New combination spec(s) (AC2, AC3, AC4, AC5)**
  - [x] Add spec file(s) under `packages/web/tests/`. **Recommended:** one file per concern, named so they sort **before the mutating specs** (`chat.spec.ts`, `docs.spec.ts`) — e.g. `adaptive-shell.spec.ts` and `theme-light.spec.ts` both sort before `chat`. This lets the mobile spec read the seed-fresh unread-docs badge before `docs.spec.ts`'s mark-all zeroes it. (See Decision D3 + the ordering invariant in Dev Notes.)
  - [x] Mobile combos: set the viewport via `test.use({ viewport: { width: 390, height: 844 } })` at the `describe` level (drives `matchMedia('(max-width:760px)')` → `isMobile=true` at mount). Assert AC2 shell anchors and AC3 chat geometry, once per theme (dark and light).
  - [x] Light-theme combos (mobile×light and desktop×light): call `loginAs(page, 'e2e-member', 'light')` and assert AC4 token anchors per view.
  - [x] Login screen: do **not** call `loginAs` — set the theme via `page.addInitScript(...)` + the viewport, `page.goto('/')`, and assert the light/mobile anchor on the login screen (mirror `auth-guest.spec.ts`'s login-screen test, which already navigates unauthenticated with a forced theme).
  - [x] Keep every new test **non-mutating** (AC5). Assert **computed** values (`toHaveCSS`), annotating each constant with its token name (`--bg` / `--tx` / `--accent-ink`), mirroring the existing `search.spec.ts` style.
- [x] **Task 3 — (Only if needed) locate the view scroll container for `contentPad` (AC2/AC5, optional)**
  - [x] The three view scroll containers (`SearchView`/`DocsView`/`StatsView`) have **no `data-testid`**. Prefer asserting `contentPad` (mobile `22px 16px 104px` vs desktop `34px 40px 60px`) via a known child's `.closest(...)` or a role/structural locator — **avoid touching source**. If a testid is genuinely required, that is a source change and an open question (see end) — default to NOT adding it and keep 11.5 e2e-only.
- [x] **Task 4 — Verification gate (AC6)**
  - [x] Run and paste: `npm run lint`, `npm run test`, `npm run build`.
  - [x] Run `npm run test:e2e -w @share2brain/web`; confirm the pre-existing 28 tests stay green (zero assertion churn) and the new combination tests pass. Note the new total.
  - [x] Prereqs (from `tests/README.md`): `docker compose up -d postgres redis` + local Homebrew Redis on 6379, `npx playwright install chromium`, DB migrated.
- [x] **Task 5 — Docs & story record**
  - [x] Update this story's Dev Agent Record + File List + Change Log; set status to `review`. Update `tests/README.md` to document the new combinations, the `loginAs(theme)` param, and the ordering placement of the new specs.

## Dev Notes

### Harness mechanics you must respect

- **The harness asserts computed CSS, not pixels.** Use `await expect(locator).toHaveCSS('prop', value)`. Colors are canonical `rgb(r, g, b)` strings (spaces after commas); pixels `'62px'`; `font-family` via regex `/IBM Plex Mono/`. `toHaveCSS` auto-retries (absorbs the 250ms search debounce). [Source: `packages/web/tests/search.spec.ts`]
- **Layout switches on `matchMedia('(max-width: 760px)')`, not on a bare resize.** Playwright's `viewport` (project or `test.use`) drives `matchMedia` in Chromium, so a 390-wide viewport flips `isMobile` true **before mount** if set before the first navigation — set it at `describe` scope with `test.use({ viewport })`. jsdom has no `matchMedia` (that's why unit tests stay desktop); irrelevant here. [Source: `packages/web/src/hooks/useIsMobile.ts`; `packages/web/src/App.tsx`]
- **Theme is set by `data-kh` on `<html>`, applied by the blocking script in `index.html` from `localStorage['share2brain-theme']` before first paint.** `loginAs` seeds that localStorage key via `page.addInitScript`. To run light, pass `'light'`. Dark is the default token block (`:root, [data-kh="dark"]`); light is `[data-kh="light"]`. [Source: `packages/web/index.html`; `packages/web/src/hooks/useTheme.ts`; `packages/web/src/styles/global.css` L21–30]
- **Conditional render, never `display:none`.** `AppLayout` renders `isMobile ? <BottomNav/> : <Sidebar/>` — on mobile the Sidebar is **not in the DOM** and vice-versa. Assert **presence/absence** (element count), not `display`. Same for the mobile-only header hexagon and the desktop-only statsLine/live-pulse/username. [Source: `packages/web/src/components/AppLayout.tsx`, `Header.tsx`]

### Existing `data-testid` inventory (use these; don't invent locators)

- Header: `live-pulse` (desktop-only pill dot), `guest-mode-badge` (guest-gated, NOT mobile-gated).
- Sidebar: `sidebar-badge` (desktop unread badge). BottomNav: `bottom-nav-badge` (mobile unread badge, Docs item, only when unread > 0). BottomNav `<nav>` and header hexagon have **no** testid → target `<nav>` by role / `.kh-bottom-nav-item` (×3) / count `.kh-nav-item` (sidebar items) for presence checks.
- ChatWidget: `chat-fab`, `chat-panel`, `chat-launcher-dot`, `chat-empty-state`, `chat-suggestion`, `chat-input`, `chat-send`, `chat-citation`, … (open the panel by clicking `chat-fab`; do **not** send a message — that mutates).
- SearchView: `search-empty-state`, `similarity-bar`. DocsView: `doc-row-content`, `doc-row-check`, `doc-row-dot`, `doc-row-new-badge`, `docs-empty-state`. StatsView: `stats-kpi-card`, `stats-activity-chart`, `stats-channel-row`, `stats-coverage-donut`, `stats-top-user-row`. LoginScreen: `guest-login-btn`.
- **Gap:** the three view scroll containers (where `contentPad` lives) have no testid — see Task 3.

### Concrete computed-value reference (mobile / desktop × light / dark)

Mobile viewport target **390×844**. Desktop default **1280px** (`devices['Desktop Chrome']`).

**Mobile shell (AC2) — token-dependent values shown per theme:**

| Element / locator | Property | Value |
|---|---|---|
| BottomNav `<nav>` (role nav / `.kh-bottom-nav-item` parent) | `position` / `bottom` / `height` / `z-index` | `fixed` / `0px` / `62px` / `55` |
| BottomNav bar | `padding-bottom` | `0px` (env safe-area = 0 in headless Chromium) |
| BottomNav bar | `background-color` | dark `rgb(11, 14, 19)` · light `rgb(236, 238, 241)` (--bg-deep) |
| BottomNav bar | `border-top-color` | dark `rgb(24, 29, 37)` · light `rgb(236, 238, 241)` (--line) |
| `.kh-bottom-nav-item` (active, has `aria-current="page"`) | `color` | dark `rgb(245, 166, 35)` · light `rgb(154, 91, 0)` (--accent-ink) |
| `.kh-bottom-nav-item` (inactive) | `color` | dark `rgb(124, 132, 148)` · light `rgb(121, 130, 143)` (--tx4) |
| `bottom-nav-badge` (Docs, member) | `background-color` / `color` | `rgb(245, 166, 35)` / `rgb(14, 17, 22)` — **theme-independent** (#F5A623 / --on-accent) |
| `bottom-nav-badge` text | content | seeded member unread count (read the exact value from `sidebar-badge` in `docs.spec.ts` / seed.ts; assert that value, or `/^\d+$/` to stay mutation-tolerant) |
| Sidebar (`.kh-nav-item`) | count on mobile | **0** (absent) |
| Header (`banner`) | `padding` | mobile `0px 14px` · desktop `0px 26px` |
| Header `live-pulse` / statsLine / username | presence on mobile | **absent** (present on desktop) |
| Header hexagon (first svg in left cluster) | presence on mobile | **present** (absent on desktop) |

**Chat geometry (AC3) — theme-independent:**

| Locator | Property | Mobile | Desktop |
|---|---|---|---|
| `chat-fab` | `bottom` / `right` | `78px` / `16px` | `24px` / `24px` |
| `chat-fab` | `position` / `width` / `height` / `z-index` | `fixed` / `60px` / `60px` / `60` | same |
| `chat-panel` (open) | `bottom` / `right` | `78px` / `16px` | `24px` / `24px` |
| `chat-panel` | `width` / `height` | `404px` / `642px` | `404px` / `642px` (unchanged) |
| `chat-panel` | `max-width` | `calc(100vw - 32px)` → resolves `358px` at 390 wide | resolves `1248px` at 1280 wide |
| `chat-panel` | `max-height` | `calc(100vh - 48px)` → `796px` at 844 tall | resolves per viewport |
| `chat-panel` (border-strong / bg) | `border-color` / `background-color` | dark `rgb(42,49,61)` / `rgb(14,17,22)` · light `rgb(211,216,223)` / `rgb(244,245,247)` | same tokens |

> Note (from Story 11.4 VERIFY): at 390×844 the panel's natural `height:642` < `max-height:796`, and `top = 844 − 78 − 642 = 124px` → **no clip**. `max-width`/`max-height` are STATIC (not `isMobile`-bound) by design — assert them **unchanged** between viewports; do not expect a per-device value.

**Light vs dark token table (AC4) — computed `rgb`, from `global.css`:**

| Token | Dark | Light | Anchor element |
|---|---|---|---|
| `--bg` | `rgb(14, 17, 22)` | `rgb(244, 245, 247)` | body / Header bg / chat panel bg |
| `--bg-deep` | `rgb(11, 14, 19)` | `rgb(236, 238, 241)` | BottomNav bar / Sidebar bg |
| `--surface` | `rgb(18, 22, 29)` | `rgb(255, 255, 255)` | live pill / guest badge bg |
| `--card` | `rgb(22, 27, 34)` | `rgb(255, 255, 255)` | result cards / KPI cards |
| `--line` | `rgb(24, 29, 37)` | `rgb(236, 238, 241)` | BottomNav border-top / Header border-bottom |
| `--border-strong` | `rgb(42, 49, 61)` | `rgb(211, 216, 223)` | chat panel border / header separator |
| `--tx` | `rgb(230, 233, 239)` | `rgb(27, 31, 39)` | body / result title text |
| `--tx2` | `rgb(199, 205, 216)` | `rgb(57, 65, 77)` | username / result description |
| `--tx4` | `rgb(124, 132, 148)` | `rgb(121, 130, 143)` | statsLine / inactive bottom-nav item |
| `--accent-ink` | `rgb(245, 166, 35)` | `rgb(154, 91, 0)` | active bottom-nav / active chip / **all focus rings** |
| `--on-accent` | `rgb(14, 17, 22)` | `rgb(14, 17, 22)` | badge text — **theme-independent** |

> **Key light-theme gotcha:** `--accent-ink` is `#F5A623` (amber) in dark but **`#9A5B00` `rgb(154, 91, 0)`** in light — this is the single most impactful theme delta (active bottom-nav tab, active search chip, every `:focus-visible` outline). The raw brand `#F5A623` (badge bg, live-pulse dot) stays `rgb(245, 166, 35)` in both themes — do not confuse the two. `--bg-deep` and `--line` are the same value in light (`#ECEEF1`), so the BottomNav border is invisible against the bar there (assertion still passes as `rgb(236, 238, 241)`).

### Recommended structure (Decisions)

- **D1 — Extend the existing helper, don't fork it.** Add `theme` param to `loginAs` with `'dark'` default → existing callers untouched (zero churn, mirrors Story 11.4's optional-prop / default-false discipline). Signature: `loginAs(page, code = 'e2e-member', theme: 'dark' | 'light' = 'dark')`.
- **D2 — New combination coverage via NEW spec files + `test.use({ viewport })`, NOT a Playwright project matrix.** Rationale: the existing 6 specs assert **dark-desktop** computed values hard-coded; running them under new light/mobile projects would break every assertion. A project matrix would force per-project `testMatch`/`testIgnore` plumbing and risks re-running (and breaking) the dark suite. New spec files keep the single `chromium` (Desktop Chrome, dark-forced) project **exactly as-is** and add mobile/light coverage in isolation. *(Alternative considered — dedicated `mobile-light`/`desktop-light` projects with `testMatch` scoping — rejected as higher-churn and harder to keep ordering deterministic; see open question if the team prefers it.)*
- **D3 — New specs are NON-MUTATING and sort before the mutating specs.** Playwright discovers alphabetically with `workers: 1`. `chat.spec.ts` (streaming persists a conversation) and `docs.spec.ts` (mark-all flips coverage → 100% and empties the unread badge) are the mutating specs. A new file that asserts the seed-fresh unread `bottom-nav-badge` **must sort before `docs.spec.ts`** — recommend names sorting before `chat`/`docs` (e.g. `adaptive-shell.spec.ts`, `theme-light.spec.ts`). If a new test asserts only mutation-independent values (layout px, theme colors), ordering is free — but keep them before the mutators anyway for safety. Never point a new spec at a mutating flow. [Source: `packages/web/tests/README.md` §"Spec discovery order (invariant)"]
- **D4 — Viewport 390×844 via explicit `viewport` only.** No need for the context `isMobile`/`hasTouch` flags — the design keys off `matchMedia` width alone. Keep it minimal (`test.use({ viewport: { width: 390, height: 844 } })`). Optionally spread `devices['iPhone 12']` (also 390×844) if a UA is ever wanted, but plain viewport is sufficient and clearer.
- **D5 — Assert the matrix deltas, not the whole value set.** desktop×dark is already fully covered by the existing specs. For each new combo assert only the **combo-defining anchors** (mobile → shell/geometry per AC2/AC3; light → tokens per AC4) on one representative element per view. This keeps the new suite fast and its intent legible, and avoids duplicating the desktop×dark assertions.

### Previous-story intelligence (11.4, and 11.1–11.3)

- **11.4** shipped the FAB/panel responsive corner: `chatBottom = isMobile ? 78 : 24`, `chatRight = isMobile ? 16 : 24`, drilled `isMobile` `App → ChatWidget`, values kept **numeric** → desktop DOM byte-identical → **zero e2e churn (28 e2e green)**. 11.4 explicitly deferred **mobile visual capture to 11.5** ("Mobile visual capture is 11.5's job") — this story is that owner. Its VERIFY note pre-computed the no-clip geometry at 390×844 (above). [Source: `11-4-...md` Completion Notes]
- **11.2** added `useIsMobile` (matchMedia, add/remove listener, jsdom-safe guard → desktop under jsdom), the `AppLayout` sidebar/bottom-nav switch, header compaction, `viewport-fit=cover` + `env(safe-area-inset-bottom)`. **11.3** applied `contentPad`, DocsView horizontal scroll (`overflow-x` on `min-width`, not the body), fluid Search widths. **11.1** refreshed the token palette (both `:root`/dark and `[data-kh="light"]`) and hover/focus states.
- Cross-story pattern: each 11.x kept the **desktop×dark e2e baseline at 28, zero assertion churn**. Preserve that here — the new tests are additive.

### Testing standards summary

- Runner: `@playwright/test`, `import { expect, test }`; helper `import { loginAs } from './helpers/session'`. Group per `test.describe('Story 11.5 — <combo>')`. Assert `toHaveCSS` with rgb/px constants annotated by token name.
- Prereqs: `docker compose up -d postgres redis` + Homebrew Redis on 6379 (this Mac's compose Redis publishes no ports), `npx playwright install chromium`, DB migrated. `workers: 1`, chromium only, single seeded DB shared across specs. [Source: `packages/web/tests/README.md`]
- Seed identities: `e2e-member` (default — general(3)+random(2)=5 resources, 2 pre-read; `sidebar-badge`/`bottom-nav-badge` = unread count), `e2e-empty` (empty scope → empty states), guest via `loginAsGuest`. RBAC canary trio must never surface. [Source: `packages/web/tests/README.md`; `packages/backend/src/e2e/seed.ts`]

## Project Structure Notes

- **Files touched (expected):** `packages/web/tests/helpers/session.ts` (add `theme` param, default `'dark'`), 1–2 new `packages/web/tests/*.spec.ts` files, `packages/web/tests/README.md` (document combos + ordering). Optionally `packages/web/playwright.config.ts` **only if** the team chooses the project-matrix alternative (D2) — default plan does **not** touch it.
- **Not touched:** any `packages/web/src/**` production file (unless Task 3's optional testid is approved — default no), any other package. AD-3 / AD-6 intact.
- Naming: new spec files `camelCase`/kebab as existing (`adaptive-shell.spec.ts`, `theme-light.spec.ts`), co-located under `tests/`. English only in code/comments/tests. [Source: `_bmad-output/project-context.md` §Code quality & naming]

## References

- [Source: `_bmad-output/planning-artifacts/epics.md` §"Épico 11" — Historia 11.5]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-responsive-refresh.md`]
- [Source: `packages/web/playwright.config.ts` — single chromium/Desktop Chrome project, dark-forced, `screenshot: only-on-failure`, two webServers]
- [Source: `packages/web/tests/README.md` — harness overview, session bootstrap, seed identities, **spec discovery-order invariant**]
- [Source: `packages/web/tests/helpers/session.ts` — `loginAs` / `loginAsGuest`, dark-theme init script to parametrize]
- [Source: `packages/web/tests/search.spec.ts` — computed-style / `toHaveCSS` assertion pattern to mirror]
- [Source: `packages/web/src/hooks/useIsMobile.ts` — `matchMedia('(max-width: 760px)')` breakpoint]
- [Source: `packages/web/src/hooks/useTheme.ts`, `packages/web/index.html` — `data-kh` FOUC-free theme init]
- [Source: `packages/web/src/styles/global.css` L21–30 — dark vs light token blocks]
- [Source: `packages/web/src/components/{AppLayout,Header,BottomNav,Sidebar,ChatWidget}.tsx` — conditional render + data-testids + geometry consts]
- [Source: `_bmad-output/implementation-artifacts/11-4-web-chat-widget-responsive-fab-panel.md` — FAB/panel consts, no-clip geometry, "mobile visual capture is 11.5's job"]
- [Source: `_bmad-output/project-context.md` — AD-3/AD-6, frontend rules, testing rules, naming]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story)

### Debug Log References

- E2E prereqs: `DATABASE_URL` / `REDIS_URL` are required by the spawned test backend
  (`src/e2e/server.ts`, audit L-6 — no default fallback). Exported them from `.env`
  for the run; the reachable local Redis on 6379 is passwordless (test-helpers
  default), so `REDIS_URL=redis://127.0.0.1:6379` (no auth) is what the harness needs.
- **AC3 correctness finding (fixed in-spec):** at 390×844 the chat panel's *used*
  `width` is **358px**, not the 404px declared width — `getComputedStyle('width')`
  returns the laid-out width, which `max-width:calc(100vw - 32px)` (=358 at 390 wide)
  clamps. The initial assertion (`404px`, taken from the AC's declared-value wording)
  failed against the real cascade; corrected to `358px` with a comment, since the
  harness asserts computed reality (the panel genuinely renders 358 wide, fitting with
  16px side margins: 358+16+16=390). Height stays natural 642 (< max-height 796 → no
  clip), matching the Story 11.4 VERIFY note.

### Completion Notes List

- **Task 1 (AC1):** `loginAs(page, code = 'e2e-member', theme = 'dark')` — added the
  `theme` param + `HarnessTheme` type; the init script now seeds the param value.
  Default `'dark'` → all pre-11.5 callers byte-identical. `loginAsGuest` untouched
  (still dark). Pre-existing 28 tests stayed green byte-for-byte (zero assertion edits).
- **Task 2 (AC2/AC3/AC4/AC5):** two NEW non-mutating specs, no Playwright project matrix
  (D2). `adaptive-shell.spec.ts` (mobile 390×844 via `test.use({ viewport })`, sorts
  FIRST → seed-fresh badge `3`): AC2 shell (BottomNav fixed/62px/--bg-deep/--line,
  Sidebar absent, active `--accent-ink` + aria-current, header pad `0px 14px`, hexagon
  present, live-pulse + username absent), AC3 chat geometry, AC5 nav-switch (docs+stats),
  mobile×light tokens, mobile login screen (dark+light). `theme-light.spec.ts`
  (desktop×light, sorts LAST — asserts only tokens, never seed-fresh counts): AC4 anchors
  across login/search/docs/stats/chat.
- **Task 3 (optional, NOT needed):** kept 11.5 strictly e2e-only — no source testid added.
  Mobile-shell anchors covered via BottomNav/Header + existing testids (`doc-row-content`,
  `stats-kpi-card`) and a structural hexagon locator (`[style*="polygon"]`); `contentPad`
  was not asserted (AC2/AC5 satisfied without it).
- **Note (token fidelity):** the result/KPI cards use `var(--surface)`, not `--card` — in
  the light theme both are `#FFFFFF rgb(255,255,255)`, so the AC4 value holds; annotated
  as `--surface` in the specs to stay truthful to the real token.
- **Task 4 (AC6) — full gate green:** `npm run lint` 0/0 · `npm run test` 1094 passed
  (1 pre-existing skip) · `npm run build` clean for all 5 packages · `npm run test:e2e -w
  @share2brain/web` **38 passed** (28 pre-existing byte-identical + 5 adaptive-shell + 5
  theme-light). Diff touches only `packages/web/tests/**` — no shared/backend/workers/bot,
  no Drizzle/Zod/API/SSE, no new dependency, no `@media`/`@keyframes`. AD-3 + AD-6 intact.
- **Task 5:** `tests/README.md` documents the `loginAs(theme)` param, the light/mobile
  combos, and the new specs' discovery-order placement (adaptive-shell first, theme-light
  last, with the seed-fresh-vs-token-only rationale).

### File List

- `packages/web/tests/helpers/session.ts` (modified — `theme` param + `HarnessTheme` type)
- `packages/web/tests/adaptive-shell.spec.ts` (new — mobile combos, AC2/AC3/AC5 + mobile×light)
- `packages/web/tests/theme-light.spec.ts` (new — desktop×light, AC4)
- `packages/web/tests/README.md` (modified — theme param, combos, spec ordering)
- `_bmad-output/implementation-artifacts/11-5-web-e2e-harness-visual-movil-tema-claro.md` (story record)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status → review)

## Change Log

| Date       | Change                                                                                          |
|------------|-------------------------------------------------------------------------------------------------|
| 2026-07-13 | Story 11.5 created via bmad-create-story. Extend the computed-style e2e harness to mobile (390×844) + light theme across login/search/docs/stats/chat for combos mobile×dark, mobile×light, desktop×light. Parametrize `loginAs(theme)`, add non-mutating combo spec(s) sorted before mutating specs; keep desktop×dark suite (28 tests) byte-identical. Status → ready-for-dev. |
| 2026-07-13 | Code re-review R2 (bmad-code-review, extra scrutiny, same 3 layers @ Opus 4.8). CONVERGED: 0 actionable (0 decision / 0 patch / 0 defer / 2 dismissed). Edge Case Hunter verified the R1 statsLine fix is a genuine non-vacuous guard (a/b/c: `/pgvector/` present in both locales; desktop would fail-if-leaked; no other banner match). Auditor: all 6 ACs SATISFIED, no regression from the R1 patch. Blind: no actionable defects (2 Low residual notes — `addInitScript` accumulation + negative-assertion nature — non-blocking, reconfirmed correct). No code change in R2 → gate not re-run. Story stays done. |
| 2026-07-13 | Code review R1 (bmad-code-review, 3 layers @ Opus 4.8). 1 patch applied: added `statsLine` desktop-only absence assertion to the mobile×dark AC2 test (`adaptive-shell.spec.ts:87`, text `/pgvector/`) — closes the AC2 enumeration gap. 13 findings dismissed. E2E re-run green: 38 passed (28 pre-existing byte-identical + 10 new). Status → done. |
| 2026-07-13 | Story 11.5 implemented (bmad-dev-story). `loginAs(theme='dark')` param; 2 new non-mutating specs (`adaptive-shell` mobile 390×844 first, `theme-light` desktop×light last). AC3 fix: chat panel used-width is 358px (max-width clamp), not the 404px declared value. Gate green: lint 0/0, vitest 1094, build 5 pkgs, e2e 38 passed (28 pre-existing byte-identical + 10 new). Frontend/e2e-only; AD-3/AD-6 intact. Status → review. |

## Review Findings

_Code review 2026-07-13 (bmad-code-review, 3 adversarial layers @ Opus 4.8 — Blind Hunter / Edge Case Hunter / Acceptance Auditor). Triage: 0 decision / 1 patch / 0 defer / 13 dismissed. Edge Case Hunter verified every token value, geometry constant, selector, the spec-ordering invariant, the seeded unread count (5−2=3) and the non-mutating claims against source — the diff is well-constructed._

- [x] [Review][Patch] AC2: `statsLine` desktop-only absence not asserted on mobile — AC2 enumerates three desktop-only header elements (`statsLine`, `live-pulse`, username); the mobile×dark test asserts only `live-pulse` + username absence. Add a `statsLine` count-0 check (text `/pgvector/` — `Header.tsx:82-92`, `t('app.statsLine')` = "indexación de conocimiento · pgvector", shares the same `!isMobile` guard). [packages/web/tests/adaptive-shell.spec.ts:86]
