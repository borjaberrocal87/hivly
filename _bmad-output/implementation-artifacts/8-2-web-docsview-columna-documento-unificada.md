---
baseline_commit: ab044ac0a8b376380fb201aecb96af7d27e42d9a
---

<!-- Powered by BMAD-CORE™ -->

<!-- story_key: 8-2-web-docsview-columna-documento-unificada -->

# Story 8.2: web — DocsView: columna «Documento» unificada (título + descripción)

Status: done

<!-- Ultimate context engine analysis completed - comprehensive developer guide created.
     Built on the 8.1 story as the direct predecessor template; current DocsView.tsx /
     DocsView.test.tsx / tests/docs.spec.ts / locales/{es,en}.json / parity.test.ts /
     components.css read in full at ab044ac; SCP §4 (design decision, Borja-confirmed) and
     epics.md UX-DR12/UX-DR13/Historia 8.2 (already synced by the correct-course step) folded in. -->

## Story

As a **community member browsing the Documentos view**,
I want **each resource's title and description to sit together in a single "Documento" column
(title on line 1 with the "Nuevo" badge when unread, description stacked directly beneath in
secondary text)**,
so that **the table row reads like the Búsqueda result cards (title over description) and stops
wasting a narrow standalone description column**.

**Scope**: `packages/web` ONLY — `DocsView.tsx` (table header + `DocRow` cell structure + the two
grid `gridTemplateColumns`/`minWidth` values), `DocsView.test.tsx`, `tests/docs.spec.ts` (visual
harness), and `src/locales/{es,en}.json` (column-header keys). Frontend-only, **Moderate**
[Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-docsview-documento.md].
Épico 8 reopened `done → in-progress` for this follow-on (same pattern/precedent as Story 8.1).

**Out of scope**: any backend/shared/workers/bot change; any Zod contract or DDL (`DocumentFragment`
unchanged — `title`, `description`, `link` still served verbatim); `components.css` and `global.css`
(**no CSS change** — `.kh-doc-link`, `.kh-doc-row:hover`, focus ring all stay); SearchView,
chat/citations, Sidebar, Header; the `epics.md` planning edits (UX-DR12, UX-DR13, Historia 8.2)
**already applied by the correct-course step** — verify, do not re-author; the pre-existing stale
Historia 4.4 Gherkin AC in `epics.md` (still says "chunk / 4 cols / `--dot-read`" — a known drift,
UX-DR12/UX-DR13 are authoritative, leave it); the 8.1-deferred empty-description placeholder
(see D5 — this story *resolves* the trigger for that defer, no code needed).

**Critical context — this is a DOM-merge re-skin, not a re-wire, and even smaller than 8.1.**
Every behavior in DocsView is done and thrice-review-hardened (4.4 + 7.5 + 8.1): optimistic
mark-read + revert, mark-all snapshot revert, server-side `channelId`/`unreadOnly` filters,
"Cargar más" abort/race guards, the bubbling "ver recurso" icon-button (7.5 F2 / 8.1 AC4), sidebar
badge via `onUnreadChange`. **8.2 changes ONLY**: (a) the header from 6 spans → 5 (drop
`descripción`, rename `título`→`documento`), (b) the `DocRow` grid from 6 tracks → 5 and the
description `<span>` from its own grid cell **into** the title cell's content wrapper (after the
"Nuevo" badge), (c) the two `minWidth` values 720→620, (d) two locale keys. Zero
handler/state/effect/API/CSS changes. If you find yourself editing `handleRowClick`,
`handleMarkAll`, `loadMore`, any `useEffect`, or any `.css` file — stop, you're off-scope.

## Design source of truth (extracted, authoritative)

The reference design `docs/context/design/Share2Brain Web.dc.html` (modified for this change) is a
single-line encoded mock — do NOT re-parse it. The DocsView "Documento" treatment is extracted here
verbatim from the Borja-confirmed SCP §3–§4 and UX-DR12/UX-DR13. Design tokens map to app tokens
(Story 5.3 map): `--tx`→`--text-primary`, `--tx3`→`--text-tertiary`, `--tx5`→`--text-subtle`.

**Header + row grid (identical on both), NEW 5-track:**
`gridTemplateColumns: 'minmax(240px,1fr) 44px 92px 116px 84px'`, `gap: 12`, `minWidth: 620`
(columns: `documento · link · canal · autor · indexado`).
_Was:_ `'150px minmax(160px,1fr) 44px 92px 116px 84px'`, `minWidth: 720` (6 tracks).

**Header labels** (mono uppercase 10.5px `--text-subtle`, styling unchanged): five spans —
`documento · link · canal · autor · indexado`. The `descripción` header span is **removed**;
the `título` span becomes `documento`.

**"Documento" cell (stacked, one grid cell)** — the existing outer título cell
(`display:flex; gap:9px; align-items:flex-start; min-width:0`) with its 16px indicator slot
(dot XOR checkmark, unchanged) and its inner content wrapper (`min-width:0; flex:1`). Inside that
content wrapper, in order:
1. **Title** span (`data-testid="doc-row-content"`, unchanged): 13.5px, line-height 1.4, color
   **always `var(--text-primary)`**, `fontWeight` 700 (unread) / 500 (read), 2-line `-webkit-box`
   clamp.
2. **"Nuevo" badge** (`data-testid="doc-row-new-badge"`, unread only, unchanged): mono 9.5px,
   `--accent-ink` on `rgba(245,166,35,0.13)`, `marginTop:5`.
3. **Description** span (`data-testid="doc-row-description"`, **moved here** from its own grid
   cell): 13px, line-height 1.5, `color: var(--text-tertiary)`, 2-line `-webkit-box` clamp
   (`overflow:hidden; text-overflow:ellipsis; -webkit-line-clamp:2; -webkit-box-orient:vertical`)
   — **same styling as today**, plus a small top gap (D1) so it doesn't collide with the title/badge.

**Link · canal · autor · indexado cells**: content and styling **unchanged** — they only shift
one grid position (the description track is gone). The link column stays the 28×28 `.kh-doc-link`
icon-button with bubbling preserved (no `stopPropagation`).

## Decisions embedded in the ACs (recommended defaults — veto at review)

| # | Fork | Decision |
|---|---|---|
| D1 | Vertical spacing of the description now that it stacks under title/badge | Add `marginTop: 4` to the description span (a presentation detail — the old standalone-cell description had no top margin). Read rows: title → description (gap 4). Unread rows: title → badge (`marginTop:5`) → description (`marginTop:4`). Keeps the SearchView "description below title" rhythm (UX-DR11) without over-tightening. Vetoable value at review. |
| D2 | Column-header locale key | Rename `docs.columns.title` → `docs.columns.document` (value `"documento"` / `"document"`) and **remove** `docs.columns.description` from BOTH `es.json` and `en.json`. ⚠️ **Lockstep is mandatory**: `parity.test.ts` fails loudly if a key exists in one locale and not the other — edit both files identically (rename in both, delete in both). |
| D3 | Grid tracks / min-width | `minmax(240px,1fr) 44px 92px 116px 84px`, `minWidth: 620` on BOTH the header div and `DocRow` (design-verbatim, SCP §4.2/§4.4). `gap: 12` unchanged. Like 8.1's `minWidth`, this is effectively **inert** — the 5 fixed/floor tracks + gaps + 40px padding give an intrinsic min ≈ 664px (>620), so the track floors already guarantee no-crush + horizontal scroll; kept literal to match AC1. |
| D4 | Where the description `<span>` lives | Move it **inside** the content wrapper `<div style={{ minWidth: 0, flex: 1 }}>` (currently DocsView.tsx:469), appended after the conditional "Nuevo" badge. Do NOT leave it as a top-level grid child. Its `data-testid="doc-row-description"` and clamp styling are preserved (SCP §4.4). |
| D5 | 8.1-deferred "empty description renders a blank clamped cell, no placeholder" | **No action — this story resolves the trigger.** That defer was raised precisely because 8.1 *promoted* description to its own labeled grid column, making an empty `''` value (permitted by `documents.ts`'s `description: z.string()`) conspicuous. 8.2 *de-promotes* it back to a subordinate line under the title, so an empty value is no more conspicuous than pre-8.1. Do not add a placeholder/em-dash or an `''` test — out of scope, keeps churn minimal. |
| D6 | testid discipline | KEEP all five: `doc-row-content` (title), `doc-row-description`, `doc-row-new-badge`, `doc-row-dot`, `doc-row-check`. **No new testids** — every unit/e2e locator survives; only the description's DOM position changes, and testid locators are position-independent. |
| D7 | Theme parity (AC4) | Structural, identical mechanism to 8.1: every color is a theme token except the sanctioned amber literals (`#F5A623` / `rgba(245,166,35,…)`), intentionally identical in both themes. No new hardcoded theme hex. Dark verified by the e2e harness (`loginAs` forces dark); light covered by token discipline (4.3/4.4/7.5/8.1 precedent). |
| D8 | Spanish UI copy verbatim, English identifiers/comments | Only user-visible string change: header label `título`→`documento` (es) / `title`→`document` (en). Intro copy, "Nuevo", "Ver recurso", "Sin leer", "Marcar todas", empty-state copy — all UNCHANGED. |

## Acceptance Criteria

1. **5-column layout (AC1)** — Both the table header and every `DocRow` use
   `gridTemplateColumns: 'minmax(240px,1fr) 44px 92px 116px 84px'`, `gap: 12`, `minWidth: 620`;
   columns are `documento · link · canal · autor · indexado`. The table container keeps its
   `overflowX: 'auto'` (horizontal scroll on narrow viewports), border, radius, and background
   from 8.1.
2. **Stacked "Documento" cell (AC2)** — Within the single document cell: the 16px indicator slot
   (amber dot `data-testid="doc-row-dot"` on unread XOR `<CheckIcon size={14}>` in a
   `var(--text-subtle)` span `data-testid="doc-row-check"` on read), then the title
   (`data-testid="doc-row-content"`, clamp-2, `var(--text-primary)` in both states, weight
   700 unread / 500 read), then the "Nuevo" badge (`data-testid="doc-row-new-badge"`, unread
   only), then the description (`data-testid="doc-row-description"`, 13px `var(--text-tertiary)`)
   stacked directly beneath — all in the same cell. **Title and description wrap freely to their
   full length (no `-webkit-box` clamp / ellipsis truncation — Borja follow-up 2026-07-13); a row
   grows to 2-3 lines as needed.** The left-edge row accent
   (`boxShadow: inset 3px 0 0 #F5A623` unread / `inset 3px 0 0 transparent` read) is unchanged.
3. **Header 6→5 columns (AC3)** — The `descripción` header cell no longer exists; the first
   header cell reads `documento` (mono/uppercase/10.5px/`var(--text-subtle)` styling unchanged).
   Achieved via locale keys: `docs.columns.title`→`docs.columns.document` and
   `docs.columns.description` removed, in both `es.json` and `en.json` (parity preserved).
4. **Zero functional/state regression + theme parity (AC4)** — UNCHANGED and still green: row
   accent, dot/checkmark indicator, the `.kh-doc-link` icon-button (click opens the resource AND
   bubbles → optimistic mark-read, no `stopPropagation`), channel chips + `channelId` filter,
   "Sin leer" toggle + `unreadOnly` + local mirror + empty state, "Marcar todas como leídas" +
   snapshot revert, "Cargar más" + abort/race guards, `onUnreadChange` sidebar badge, intro/
   empty-state copy, `mostrando X de Y` label. Correct in light and dark themes. `App.test.tsx`
   (clicks `.kh-doc-row`, :216) stays green untouched.
5. **Tests updated and green (AC5)** — `DocsView.test.tsx`: the header-labels test asserts the 5
   labels (`documento · link · canal · autor · indexado`), no `descripción`; the "title +
   description on their own testids" test still passes (both testids present, now same cell) with
   its name/description updated to say "same cell"; the two header-anchored `findByText('título')`
   waits (unit :255 es, :369 en `findByText('title')`) switch to `documento`/`document`.
   `docs.spec.ts`: grid regex → 5 tracks; the header anchor `getByText('título')` →
   `getByText('documento')`; description/title clamp and `.kh-doc-link` asserts unchanged. Full
   e2e suite green, `docs.spec.ts` describe order preserved. Verification gate green:
   `npm run lint && npm run test && npm run build`.

## Tasks / Subtasks

- [x] Task 0: Branch `feat/8-2-docsview-documento-column` off `main` (`ab044ac`) — SCP §5 names
      this branch; never commit on main.
- [x] Task 1: Locales (AC3, D2) — edit BOTH `src/locales/es.json` and `src/locales/en.json`
      **in lockstep**:
  - [x] 1.1 Rename `docs.columns.title` key → `docs.columns.document` (value `"documento"` / `"document"`).
  - [x] 1.2 Delete `docs.columns.description` from both files.
  - [x] 1.3 Sanity: `parity.test.ts` must stay green (identical key trees).
- [x] Task 2: Header in `DocsView.tsx` (AC1, AC3) — at the header grid div (:306-328):
  - [x] 2.1 `gridTemplateColumns` → `'minmax(240px,1fr) 44px 92px 116px 84px'`; `minWidth: 720` → `620` (keep `gap: 12`, `padding`, bg, border, mono/uppercase styling).
  - [x] 2.2 Remove the `<span>{t('docs.columns.description')}</span>` (:323); change the first span to `{t('docs.columns.document')}` (:322). Result: 5 spans (document/link/channel/author/indexed).
- [x] Task 3: `DocRow` in `DocsView.tsx` (AC1, AC2, D1, D4) — at the row grid + cells (:411-591):
  - [x] 3.1 Row `gridTemplateColumns` → `'minmax(240px,1fr) 44px 92px 116px 84px'` (:431); `minWidth: 720` → `620` (:433). All other row styles (accent boxShadow, padding, border, cursor, a11y role/tabIndex/onKeyDown) unchanged.
  - [x] 3.2 Move the description `<span data-testid="doc-row-description">` (currently the standalone grid child at :510-524) **into** the content wrapper `<div style={{ minWidth: 0, flex: 1 }}>` (:469), appended right after the conditional "Nuevo" badge block (after :506). Keep its exact clamp styling; add `marginTop: 4` (D1). Remove the now-empty standalone grid position.
  - [x] 3.3 Verify the remaining grid children are now exactly 5 in order: document cell (the `display:flex` wrapper) · link anchor · canal span · autor div · indexado span. No stray empty cell.
- [x] Task 4: `DocsView.test.tsx` (AC5) —
  - [x] 4.1 Header-labels test (:72-85): rename to "…5-column table header labels"; drop `expect(screen.getByText('descripción'))`; change `findByText('título')` → `findByText('documento')`; keep link/canal/autor/indexado asserts.
  - [x] 4.2 "title and description separately on their own testids" test (:97-107): keep both testid assertions (still valid, same cell); update the `it(...)` name/comment to "…stacked in the same cell" so it isn't misleading.
  - [x] 4.3 Empty-state test wait (:255): `findByText('título')` → `findByText('documento')`.
  - [x] 4.4 en-locale test (:362-370): `findByText('title')` → `findByText('document')` (English header now `document`).
  - [x] 4.5 Leave every behavioral test untouched (row-click, no-op, filters, pagination, mark-all revert, error state, page-race + abort guards, bubbling `ver recurso`).
- [x] Task 5: `tests/docs.spec.ts` (AC5) — per Dev Notes §e2e:
  - [x] 5.1 Grid assertion (:38-41): 5 tracks — `/^\d+(\.\d+)?px 44px 92px 116px 84px$/` (`minmax(240px,1fr)` resolves to px in Chromium).
  - [x] 5.2 Header anchor (:44): `page.getByText('título', { exact: true })` → `getByText('documento', { exact: true })`; keep the mono/10.5px/uppercase/`TEXT_SUBTLE` asserts.
  - [x] 5.3 Refresh the stale describe/comment blocks (:31 test title "(4.4, 8.1)"→ add 8.2; :36 "6 tracks"→"5 tracks"; :100-106 header comment) to describe the merged column. Description/title clamp asserts (:120-135) and `.kh-doc-link` asserts (:141-150) are UNCHANGED (testid/class locators are position-independent).
- [x] Task 6: Docs sync — `epics.md` UX-DR12, UX-DR13, and Historia 8.2 were **already updated by
      the bmad-correct-course step** (verified they read as this story's spec at `ab044ac`).
      No planning re-authoring needed — no discrepancy found.
- [x] Task 7: Verification gate (AGENT runs it, paste output): `npm run lint && npm run test &&
      npm run build`, then `npx playwright test` from `packages/web` (dark chromium, workers:1).
      Integration suite NOT required (no shared/backend change) — stated explicitly in the Dev
      Agent Record.

## Dev Notes

### Current state of every file being modified (read at `ab044ac`)

- **`packages/web/src/components/DocsView.tsx` (594 lines)** — Header grid div at **:306-328**
  (`gridTemplateColumns: '150px minmax(160px,1fr) 44px 92px 116px 84px'`, `minWidth: 720`, 6
  spans; the `descripción` span is :323). `DocRow` at **:407-593**: row grid at :430-431
  (same 6-track spec + `minWidth: 720` at :433). The **document (título) cell** is the
  `display:flex` wrapper at :441-508 — indicator slot :442-468 (dot/check, unchanged), content
  wrapper `<div style={{ minWidth: 0, flex: 1 }}>` at **:469-507** holding the title span
  (:470-485) + conditional "Nuevo" badge (:486-506). The **standalone description cell** is at
  **:510-524** (`data-testid="doc-row-description"`, 13px `--text-tertiary` clamp-2) — this is the
  span that moves into the content wrapper. Link anchor :526-544, canal :546-548, autor :550-579,
  indexado :581-590. **Handlers (:127-154) and effects (:46-125) are review-hardened — DO NOT
  TOUCH.** `CheckIcon`/`ExternalLinkIcon` already imported (:18).
- **`packages/web/src/components/DocsView.test.tsx` (372 lines)** — MUST change: header-labels
  test (:72-85, drops `descripción`, `título`→`documento`); testid test name (:97-107, assertions
  stay); empty-state wait (:255); en-locale wait (:369). MUST NOT change: rows render (:87-95),
  weight/color (:109-121), dot+badge/check presence (:123-160), bubbling `ver recurso` (:162-176),
  row-click mark-read (:178-192), read no-op (:194-205), `unreadOnly` toggle (:207-219), channel
  filter (:221-232), "Cargar más" (:234-248), empty state (:250-263), mark-all (:265-277), and the
  four review-patch regression tests (:281-350). Repo rules: no jest-dom
  (`toBeTruthy()`/`toBeNull()`/`getAttribute`), AAA, behavior-driven names.
- **`packages/web/tests/docs.spec.ts` (227 lines)** — three describes in mandatory order: 4.4
  visual (:30-98) → 7.6 description/link + MUTATING bubbling (:107-189) → terminal mark-all
  (:194-226). `workers: 1` pinned; dark theme forced by `loginAs`. First row = `e2e-msg-g1`, link
  `https://example.com/e2e/configurar-canales-indexados` (:22). The bubbling test route-blocks
  `https://example.com/**` and captures the popup BEFORE the click, using an **href-anchored** row
  locator (:169-174) — keep that pattern verbatim.
- **`packages/web/src/locales/es.json` / `en.json`** — `docs.columns` block: `title`/`description`/
  `link`/`channel`/`author`/`indexed` (es :68-75, en analogous). Rename `title`→`document`, delete
  `description`, in BOTH.
- **`packages/web/src/locales/parity.test.ts`** — asserts es↔en key-tree parity both directions;
  your lockstep edit keeps it green.
- **`packages/web/src/styles/components.css` (:123-143)** and **`global.css`** — `.kh-doc-row:hover`,
  `.kh-doc-link` + `:hover` + `:focus-visible`. **No change** — none of these reference the grid or
  the description; `--dot-read` was already removed in 8.1. Do NOT list these files in File List.

### e2e — exact `docs.spec.ts` changes (AC5)

- **Grid** (:38-41): `/^150px \d+(\.\d+)?px 44px 92px 116px 84px$/` → `/^\d+(\.\d+)?px 44px 92px 116px 84px$/` (5 tracks; the leading `minmax(240px,1fr)` serializes to a computed px value).
- **Header anchor** (:44): `getByText('título', { exact: true })` → `getByText('documento', { exact: true })`. All following `header` asserts (mono/font-size 10.5px/uppercase/`TEXT_SUBTLE`) unchanged.
- **Description** (7.6 describe, :120-127): `firstRow.getByTestId('doc-row-description')` still resolves (now inside the document cell) — color `TEXT_TERTIARY` + clamp asserts UNCHANGED. Do not assert `display` on the clamped span (Chromium reports `flow-root` under active `-webkit-line-clamp` — 7.6 hard-won).
- **Title** (:131-135) and **resource icon-button** (:141-150): UNCHANGED (testid/`.kh-doc-link` locators are position-independent).
- **Comments/test titles**: :31 add `8.2`; :36 "6 tracks"→"5 tracks"; :100-106 header comment describe the merged "Documento" column. Comments claiming a "standalone descripción column" would be false after this story.

### Anti-regression tripwires (learned across Epics 4–8, 10)

1. **Locale parity is a hard gate** — rename/delete keys in `es.json` AND `en.json` identically or
   `parity.test.ts` fails. This is the single most likely way to break the build here.
2. **Two header-label waits are NOT in the labels test** — `DocsView.test.tsx:255` (es empty-state)
   and `:369` (en locale) both `findByText` the header label to await render. Miss either and that
   test hangs/fails after the rename. (The SCP §4 change list omits these — flagged here.)
3. **Never assert `display` on line-clamped elements** in Playwright (computes `flow-root`).
4. **Do not reorder `docs.spec.ts` describes** — read-only → bubbling mutation → terminal mark-all;
   the seed's read/unread mix is consumed in that order.
5. **`App.test.tsx:216`** clicks `.kh-doc-row` — the class and row-level click handler must survive
   (they do; this story touches only grid tracks + cell DOM order).
6. **No CSS change, no new deps, no new icons** — if you open a `.css` file or add a testid/icon,
   you're off-scope. React 19.2 / Playwright 1.61.1 / i18next 26 pinned; no web research needed.
7. **`unreadOnly` local mirror** (`visibleDocs`) — a bubbling-marked row vanishes under "Sin leer";
   existing behavior, don't "fix" it.
8. **Description keeps clamp-2, not the whole-row height** — it's a subordinate line, not a
   full-width paragraph; the `-webkit-box`/clamp-2 styling stays as-is (only `marginTop` added, D1).

### Testing standards summary

Vitest + Testing Library, co-located, no jest-dom, AAA, behavior-named tests. jsdom ignores
external CSS — unit tests assert inline `style.*` and testid presence; pixels/cascade/hover live
in Playwright (`npx playwright test` from `packages/web`, dev server auto-started via
`preview.proxy`, workers:1, dark chromium). Run the FULL suite, not just docs.spec — search/chat/
interactions must stay green (they don't touch DocsView; `workers:1` + file order is the
cross-file invariant, docs.spec internal describe order is the in-file invariant).

### Project Structure Notes

- All changes under `packages/web/` (AD-1/AD-2/AD-3 intact — static SPA, no contracts, no DDL, no
  service coupling; `DocumentFragment` unchanged). No root `src/`. Conventional Commits scoped
  `web`. One story = one PR: `feat/8-2-docsview-documento-column` → PR → `bmad-code-review` →
  `bmad-checkpoint-preview`. Never auto-merge.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-docsview-documento.md
  — trigger, impact analysis, design decision (Borja-confirmed), §4 detailed edits, §5 branch name]
- [Source: _bmad-output/planning-artifacts/epics.md:1089-1106 — Historia 8.2 ACs; :114-116 —
  UX-DR12/UX-DR13 (already synced to the 5-col merged treatment)]
- [Source: _bmad-output/implementation-artifacts/8-1-web-docsview-rediseno-estados-leido-no-leido-y-layout-columnas.md
  — direct predecessor: 6-col layout, dot/check/badge/accent, `.kh-doc-link` (D1/D2), testid
  discipline (D4), deferred empty-description note]
- [Source: packages/web/src/components/DocsView.tsx:306-593 — current header + `DocRow`]
- [Source: packages/web/src/components/DocsView.test.tsx — unit assertions to update]
- [Source: packages/web/tests/docs.spec.ts:30-98 — 4.4/8.1 visual asserts; :107-189 — 7.6 clamp +
  bubbling harness + ordering invariant]
- [Source: packages/web/src/locales/{es,en}.json — `docs.columns` block; parity.test.ts contract]
- [Source: docs/context/design/Share2Brain Web.dc.html — extracted verbatim above; do not re-parse]
- [Source: docs/bmad-story-mandatory-steps.md — verification gate, evidence pasting]

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story)

### Debug Log References

- Verification gate (all green):
  - `npm run lint` → 0 errors.
  - `npm run test` (vitest, unit + web) → **1072 passed | 1 skipped** (1073).
  - `npm run build` → clean across 5 packages (bot/shared/web/workers tsc, web vite build OK).
  - `npx playwright test` from `packages/web` (chromium, workers:1, dark forced by `loginAs`) →
    **28 passed** (incl. `docs.spec.ts` 8.2 grid/header, 7.6 clamped description + resource
    icon-button, terminal mark-all). Infra: `docker compose up -d postgres redis` + `DATABASE_URL`/
    `REDIS_URL` sourced from `.env`.
- **Integration suite NOT run** — story is `packages/web`-only; no `shared`/`backend`/`workers`/`bot`
  change, so no SQL/contract surface to exercise (8.1 precedent). Explicit, not a silent skip.

### Completion Notes List

- DOM-merge re-skin exactly as specified — zero handler/state/effect/CSS changes. `components.css`
  and `global.css` untouched (not in File List, per Dev Notes).
- **AC1** — header + `DocRow` both use `gridTemplateColumns: 'minmax(240px,1fr) 44px 92px 116px 84px'`,
  `gap: 12`, `minWidth: 620`; table container keeps `overflowX: 'auto'`, border, radius, background.
- **AC2** — single "Documento" cell: 16px indicator slot (dot XOR checkmark) unchanged, then title
  (`doc-row-content`, clamp-2, `--text-primary` both states, weight 700/500), then "Nuevo" badge
  (`doc-row-new-badge`, unread only), then description (`doc-row-description`, 13px `--text-tertiary`,
  clamp-2) with `marginTop: 4` (D1) stacked directly beneath — all in the content wrapper. Left-edge
  accent unchanged.
- **AC3** — header 6→5 spans; first span now `docs.columns.document`. Locale keys renamed
  `docs.columns.title`→`document` and `docs.columns.description` deleted in **both** `es.json` and
  `en.json` in lockstep — `parity.test.ts` green (D2).
- **AC4** — no functional/state regression: row accent, dot/check, `.kh-doc-link` bubbling
  (no `stopPropagation`), channel/`unreadOnly` filters, mark-all snapshot revert, "Cargar más"
  abort/race guards, `onUnreadChange` sidebar badge, copy all unchanged and green. Theme parity
  structural (D7); dark verified by e2e harness, light by token discipline. `App.test.tsx` untouched.
- **AC5** — unit + e2e updated to the merged column and green; `docs.spec.ts` describe order
  preserved.
- D5 confirmed no code (empty-description defer resolved by de-promotion). No new testids, icons,
  deps, or CSS.

### File List

- `packages/web/src/components/DocsView.tsx` (modified) — header grid 6→5 tracks + `document` label;
  `DocRow` grid 6→5 tracks, `minWidth` 720→620; description `<span>` moved into the title content
  wrapper after the "Nuevo" badge with `marginTop: 4`.
- `packages/web/src/components/DocsView.test.tsx` (modified) — header-labels test → 5 labels (no
  `descripción`, `título`→`documento`); testid test renamed to "stacked in the same cell";
  empty-state wait and en-locale wait → `documento`/`document`.
- `packages/web/tests/docs.spec.ts` (modified) — grid regex → 5 tracks; header anchor → `documento`;
  describe title + comment blocks refreshed for the merged "Documento" column.
- `packages/web/src/locales/es.json` (modified) — `docs.columns.title`→`document` (`"documento"`),
  `docs.columns.description` removed.
- `packages/web/src/locales/en.json` (modified) — `docs.columns.title`→`document` (`"document"`),
  `docs.columns.description` removed.

## Change Log

- 2026-07-13 — Story created (bmad-create-story). DocsView merges título + descripción into a
  single "Documento" column (title + "Nuevo" badge + description stacked), 6→5-col grid
  (`minmax(240px,1fr) 44px 92px 116px 84px`, min-width 720→620), per
  `sprint-change-proposal-2026-07-13-docsview-documento.md`. DOM-merge re-skin: zero handler/
  effect/CSS changes. 8 ratified defaults flagged (D1 description marginTop:4; D2 locale-key
  rename+delete in lockstep — parity gate; D5 the 8.1 empty-description defer is *resolved* by
  de-promotion, no code). Fresh-context analysis caught 2 header-label waits the SCP change-list
  omitted (DocsView.test.tsx:255 es empty-state, :369 en locale). Status: ready-for-dev.
- 2026-07-13 — Story implemented (bmad-dev-story) on `feat/8-2-docsview-documento-column`. DocsView
  header + `DocRow` grid merged to 5 tracks (`minmax(240px,1fr) 44px 92px 116px 84px`, min-width
  620); description `<span>` moved into the title content wrapper after the "Nuevo" badge
  (`marginTop:4`, D1). Locale keys `docs.columns.title`→`document` + `docs.columns.description`
  deleted in lockstep (es+en, parity green). Unit + e2e updated to the merged column. Zero handler/
  effect/CSS change. Gate green: lint 0 / 1072 unit+web (1 skip) / build clean (5 pkgs) / 28 e2e
  (chromium dark). Integration NOT run (web-only). Status: review.
- 2026-07-13 — Post-review tweak (Borja): removed the 2-line `-webkit-box` clamp + ellipsis from
  both the title (`doc-row-content`) and description (`doc-row-description`) spans — they now render
  as plain `display:block` and wrap to full length (2-3 lines OK). AC2 updated; `docs.spec.ts` 7.6
  asserts switched from `-webkit-line-clamp: 2` → `none` + `display: block`. Gate re-run green:
  lint 0 / 1072 unit+web / build clean / 28 e2e.

## Review Findings (bmad-code-review, 2026-07-13)

_3 parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor). Acceptance Auditor: all
AC1–AC5 and D1–D8 satisfied, zero scope violations. 5 findings dismissed as verified false positives
or covered by explicit spec decisions (grid 5=5 children verified; description block-stacking verified;
badge order per AC2; no stray i18n refs — grep clean; empty-description test ruled out by D5)._

- [x] [Review][Patch] (resolved from Decision, applied 2026-07-13: added `overflowWrap:'anywhere'` to both spans) Long unbroken token overflows horizontally after clamp removal [packages/web/src/components/DocsView.tsx:469,502] — With the 2-line `-webkit-box` clamp + `overflow:hidden`/`textOverflow:ellipsis` removed (2026-07-13 tweak), the title (`doc-row-content`) and description (`doc-row-description`) spans render `display:block` with no `overflowWrap`/`wordBreak`. A title/description containing a long unbroken token (bare URL, long filename) overflows the `minmax(240px,1fr)` document cell and forces table horizontal scroll instead of wrapping. `minWidth:0` on the content wrapper allows flex-shrink but does not break unbroken tokens. `description: z.string()` (no min) and AI-generated titles make a URL-like value plausible. Design call: add `overflowWrap:'anywhere'` (or `wordBreak:'break-word'`) to both spans to honor the "wrap freely, no truncation" intent for edge tokens too.
- [x] [Review][Patch] (applied 2026-07-13: guarded with `{doc.description && (…)}`) Empty description leaves a stray 4px gap under the title/badge [packages/web/src/components/DocsView.tsx:502] — `description` is `z.string()` (empty allowed). The description `<span>` renders unconditionally with `marginTop:4`, so an empty value adds 4px of dead vertical space below the title (read rows) or the "Nuevo" badge (unread rows). Pre-8.1 the description was its own grid cell, so empty had no effect on the title cell height. D5 consciously ruled empty-description handling out of scope; this is the (negligible) side-effect the D5 note did not foresee. Optional guard: `{doc.description && (<span…/>)}`.
- [x] [Review][Patch] (re-run #1, applied 2026-07-13: guard hardened to `doc.description.trim()`) Whitespace-only description still renders an empty span [packages/web/src/components/DocsView.tsx:502] — the patch #2 guard used truthiness, but `description` is `z.string()` (no trim, unlike `title`'s `.trim().min(1)`), so a whitespace-only value stayed truthy and rendered a ~23px empty block. Hardened to `{doc.description.trim() && (…)}`, matching the title's contract. Surfaced by the Edge Case Hunter on re-run #1; the Acceptance Auditor confirmed the patches otherwise CONVERGED (AC1–AC5 + D1–D8 all satisfied, 0 scope drift, no test breaks — fixtures/seed all carry non-empty descriptions).
- [x] [Review][Patch] (re-run #2, applied 2026-07-13: co-location assertion added) Tests do not assert the description's nesting in the documento cell [packages/web/src/components/DocsView.test.tsx:96] — the "stacked in the same cell" test only asserted both testids exist anywhere in the tree; a regression re-promoting the description to a standalone grid column would have passed green (flagged by both Blind + Edge across rounds). Hardened: the test now asserts `title.parentElement === description.parentElement`, verifying both spans share the content wrapper (the single documento cell). Respects D5 (no empty-`''` test added). Re-run #2 CONVERGED: Auditor "Everything holds, zero violations"; Blind's 2 items verified false (`z.string()` required → no `.trim()` throw; all fixtures/seed non-empty); Edge 0 code defects.
- [x] [Review][Patch] (re-run #3, applied 2026-07-13: falsy-branch test added) Guard's empty/whitespace-description branch was untested [packages/web/src/components/DocsView.test.tsx:115] — the `{doc.description.trim() && …}` guard (added during review) had zero coverage on its false branch: no fixture was empty, so dropping the guard would have shipped silently. Added a test rendering `{ ...DOC_UNREAD, description: '   ' }` asserting the title still renders and `queryByTestId('doc-row-description')` is null. D5's "no `''` test" premise (no empty-handling code) no longer holds once the review added the guard, so covering our own branch is in-scope. Re-run #3 CONVERGED: Auditor "everything holds, 0 violations, fix #4 reinforces D4/compatible D6"; Blind + Edge validated the co-location assertion as robust & non-vacuous, 0 code defects. RESIDUAL (still deferred, accepted by D6, optional): exact 5-grid-child count remains unasserted (the Playwright `grid-template-columns` regex checks the track template, not child count).
