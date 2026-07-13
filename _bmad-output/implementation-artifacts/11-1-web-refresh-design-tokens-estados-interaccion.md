---
baseline_commit: 8674626ba955d44211dc5e4a54b2bf64de0d677f
---

# Story 11.1: web — Refresh de design tokens y estados de interacción

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user of the Share2Brain web SPA on any theme**,
I want **the design-token palette and the hover/focus interaction states to match the canonical design spec exactly**,
so that **the UI is visually consistent with `Share2Brain Web.dc.html` and the later responsive stories (11.2–11.4) can copy the design's markup verbatim (it references `var(--tx…)`) without translating token names**.

## Story Context

**Foundational layer of Épico 11 (Responsive & Visual Refresh).** This is the first story in the
binding sequence `11.1 → 11.2 → (11.3 ∥ 11.4) → 11.5`. It touches **only** the two web stylesheets'
token/interaction layer plus every component's inline token references — **no layout, no responsive
behavior, no new markup**. Responsive work (breakpoint, bottom-nav, `useIsMobile`, chat repositioning)
is 11.2–11.4; extending the visual harness to mobile + light theme is 11.5.

**The core discovery driving this story (READ THIS FIRST):** the design prototype
`docs/context/design/Share2Brain Web.dc.html` uses the token names **`--tx / --tx2 / --tx3 / --tx4 /
--tx5`** and defines a **`--dot-read`** token. The web implementation (`packages/web`) has used
**`--text-primary / --text-secondary / --text-tertiary / --text-muted / --text-subtle`** since Story
2.1 and never adopted `--dot-read`. This is a **standing web deviation from the design, not a new
design change** — verified: the HEAD version of the design already used `--tx*` + `--dot-read` with the
**exact same color values**. This story realigns the web to the canonical names. **Because the color
values are byte-identical, there is zero visual/pixel change** — this is a rename + one reserved token,
not a re-skin.

> **Verified against the design (2026-07-13):** the token *values* AND the full set of `style-hover` /
> `style-focus` interaction values are **byte-identical between the HEAD design and the current
> (modified) design**. The design's `+1126 / −190` diff is entirely (a) reformatting minified→pretty
> and (b) the responsive additions owned by 11.2–11.5. **Nothing in 11.1's surface actually changed in
> the design** — the work is web-catches-up-to-spec, plus one genuine interaction fix (doc-link hover,
> see D3).

## Acceptance Criteria

```gherkin
AC1 — Token palette matches the design verbatim (names, values, selector, new token)
  Given packages/web/src/styles/global.css
  When the dark and light token blocks are compared to
       docs/context/design/Share2Brain Web.dc.html lines 34–45
  Then the dark block selector is ":root, [data-kh=\"dark\"]" (not bare ":root")
   And the text-scale tokens are named --tx, --tx2, --tx3, --tx4, --tx5
       (renamed from --text-primary/-secondary/-tertiary/-muted/-subtle)
   And a --dot-read token exists in both blocks (#272E39 dark, #C7CCD4 light)
   And every other token name and every color value is unchanged (byte-for-byte)
   And no --text-primary / --text-secondary / --text-tertiary / --text-muted / --text-subtle
       token definition remains anywhere in packages/web.

AC2 — All web references migrated to the new names; no orphans
  Given the whole packages/web tree
  When you grep for the old names --text-primary|--text-secondary|--text-tertiary|--text-muted|--text-subtle
  Then there are zero hits in packages/web/src (components + styles + unit tests)
   And the stale trailing comments in packages/web/tests/*.spec.ts and tests/README.md
       that annotate rgb constants with the old token name are updated to the new name
       (the rgb constant VALUES stay the same — see AC4).

AC3 — Interaction states match the design's hover/focus spec for all primitives
  Given packages/web/src/styles/components.css
  When each .kh-*:hover / :focus / :focus-within / :focus-visible rule is compared to the
       design's style-hover / style-focus attributes (22 states, enumerated in Dev Notes)
  Then every primitive's hover/focus color, border-color, background and transform matches
       the design, INCLUDING the doc-link "Ver en Discord" hover which becomes blurple #5865F2
       (was amber var(--accent-ink) — see D3)
   And the two deliberate, previously-ratified deviations are PRESERVED, not reverted:
       (a) .kh-chat-suggestion:hover uses var(--tx) (design's #fff would be illegible in light theme),
       (b) all the extra :focus-visible outlines web adds for keyboard a11y beyond the mock stay.

AC4 — No desktop visual regression in either theme
  Given the existing E2E visual harness (Playwright, Chromium, dark theme, desktop viewport)
  When it runs after the change
  Then it passes with ZERO changes to any baseline snapshot and ZERO changes to any color
       assertion (the rgb values are unchanged; only variable NAMES changed)
   And the only unit-test edit is the two token-name string assertions in DocsView.test.tsx
       ('var(--text-primary)' → 'var(--tx)').

AC5 — Verification gate green; frontend-only; invariants intact
  Given the mandatory gate
  When "npm run lint && npm run test && npm run build" runs (agent runs it, pastes output)
  Then all pass with no red
   And the diff touches packages/web ONLY — zero change to shared, backend, workers, bot,
       the Drizzle schema, any Zod contract, or any API/SSE shape (AD-3 + AD-6 intact)
   And no new runtime dependency is added.
```

## Tasks / Subtasks

- [x] **Task 1 — Rewrite the token block in `global.css` (AC1)**
  - [x] Change the dark selector `:root {` → `:root, [data-kh="dark"] {`.
  - [x] Rename in BOTH blocks: `--text-primary`→`--tx`, `--text-secondary`→`--tx2`,
        `--text-tertiary`→`--tx3`, `--text-muted`→`--tx4`, `--text-subtle`→`--tx5`.
  - [x] Add `--dot-read:#272E39;` to the dark block and `--dot-read:#C7CCD4;` to the light block
        (appended to the `--border-hover` line, matching the design's grouping).
  - [x] Update `body { … color: var(--text-primary) }` → `var(--tx)`. The `::selection` / scrollbar
        rules use `--border-strong` / `--border-hover` (unchanged) — left as-is.
  - [x] File header comment: no token-name text existed to update (the header describes the
        palette source + raw-hex allowlist only, not individual token names) — left intact.
- [x] **Task 2 — Migrate every inline token reference in the 7 components (AC2)**
  - [x] Whole-token find-and-replace `var(--text-primary)`→`var(--tx)`, `…-secondary)`→`var(--tx2)`,
        `…-tertiary)`→`var(--tx3)`, `…-muted)`→`var(--tx4)`, `…-subtle)`→`var(--tx5)` in:
        `SearchView.tsx` (17), `ChatWidget.tsx` (19), `StatsView.tsx` (20), `DocsView.tsx` (16),
        `LoginScreen.tsx` (6), `Header.tsx` (4), `Sidebar.tsx` (3).
  - [x] Grepped the tree: **0** remaining `--text-*` references in `src/`.
- [x] **Task 3 — Align interaction states in `components.css` (AC3)**
  - [x] Replaced the 8 `--text-*` refs in `components.css` with `--tx*`.
  - [x] **D3:** changed `.kh-doc-link:hover` from `var(--accent-ink)` to Discord blurple `#5865f2`
        (lowercase to match the file's existing `.kh-discord-link` / `.kh-chat-citation` hex casing).
  - [x] **PRESERVED (not reverted):** `.kh-chat-suggestion:hover` keeps `color: var(--tx)` (was
        `--text-primary`); all `:focus-visible` outline rules kept (a11y beyond the mock).
  - [x] Verified the 22 design interaction states against `.kh-*` rules; only D3 changed value, the
        rest change only via the token rename.
- [x] **Task 4 — Update tests + stale comments (AC2, AC4)**
  - [x] `DocsView.test.tsx`: `'var(--text-primary)'` → `'var(--tx)'` (2 assertions).
  - [x] `tests/*.spec.ts` (analytics, auth-guest, chat, docs, search) + `tests/README.md`:
        trailing `// --text-…` comments on the rgb constants updated to `// --tx…`. rgb string
        VALUES untouched.
  - [x] **Added (beyond the story plan — see Completion Notes):** `docs.spec.ts` hover assertion for
        `.kh-doc-link` (lines 143/144) changed `ACCENT_INK` → new `DISCORD_BLURPLE` constant. This
        E2E spec DID assert the doc-link hover color, so the AC3-mandated D3 change required it.
- [x] **Task 5 — Verification gate + visual harness (AC4, AC5)**
  - [x] `npm run lint && npm run test && npm run build` (repo-wide) — green (see Completion Notes).
  - [x] Ran the E2E visual harness (dark, desktop, Chromium): 28 passed. The token rename caused
        **zero** assertion churn; the single assertion changed is the D3 hover (AC3-mandated).
  - [x] Confirmed the diff is `packages/web` only.
- [x] **Task 6 — Docs sync (house rule: docs are source of truth)**
  - [x] `components.css` header/comment reflects the `--tx` naming; `global.css` header had no
        token-name text to change.
  - [x] No `TECHNICAL-DESIGN.md` / `frontend-standards.md` change needed for 11.1 — left untouched.

## Dev Notes

### Exact token rename map (memorize this — it is the whole story)

| Old web name (Story 2.1) | New canonical name (design) | dark value | light value |
|---|---|---|---|
| `--text-primary`   | `--tx`  | `#E6E9EF` | `#1B1F27` |
| `--text-secondary` | `--tx2` | `#C7CDD8` | `#39414D` |
| `--text-tertiary`  | `--tx3` | `#9AA3B2` | `#5C6573` |
| `--text-muted`     | `--tx4` | `#7C8494` | `#79828F` |
| `--text-subtle`    | `--tx5` | `#646C7C` | `#99A1AD` |
| _(new)_ `--dot-read` | `--dot-read` | `#272E39` | `#C7CCD4` |

**Values do not change — only names.** A pure, whole-token find-and-replace is safe: the five old
names are distinct, non-overlapping strings, and none is a substring of another token name. There is no
`--tx` collision risk (no existing `--tx*` in the web tree — verified 0 hits).

**Target token block, verbatim from the design (global.css lines 34–45):**
```css
:root, [data-kh="dark"] {
  --bg:#0E1116; --bg-deep:#0B0E13; --surface:#12161D; --card:#161B22; --hover-row:#141922; --track:#222934;
  --line:#181D25; --border:#20262F; --border-strong:#2A313D; --border-hover:#3A4250; --dot-read:#272E39;
  --tx:#E6E9EF; --tx2:#C7CDD8; --tx3:#9AA3B2; --tx4:#7C8494; --tx5:#646C7C;
  --hover:rgba(255,255,255,0.04); --on-accent:#0E1116; --accent-ink:#F5A623;
}
[data-kh="light"] {
  --bg:#F4F5F7; --bg-deep:#ECEEF1; --surface:#FFFFFF; --card:#FFFFFF; --hover-row:#EDEFF2; --track:#E2E5EA;
  --line:#ECEEF1; --border:#E2E5EA; --border-strong:#D3D8DF; --border-hover:#C2C8D1; --dot-read:#C7CCD4;
  --tx:#1B1F27; --tx2:#39414D; --tx3:#5C6573; --tx4:#79828F; --tx5:#99A1AD;
  --hover:rgba(0,0,0,0.05); --on-accent:#0E1116; --accent-ink:#9A5B00;
}
```
[Source: docs/context/design/Share2Brain Web.dc.html#34-45]

### The 22 design interaction states → web `.kh-*` mapping

All values below are byte-identical between the HEAD design and the current design (verified). Every
row except **D3 (doc-link)** already matches web today and only needs the token rename applied.

| Design line | `style-hover` / `style-focus` | web class | status after 11.1 |
|---|---|---|---|
| 74  | `background:#4853e0; transform:translateY(-1px)` | `.kh-discord-btn:hover` | ✓ already matches |
| 96  | `border-color:var(--accent-ink); color:var(--accent-ink)` | `.kh-guest-btn:hover` | ✓ |
| 125 | `background:var(--hover)` | `.kh-nav-item:hover` | ✓ |
| 183 | `color:var(--accent-ink); border-color:var(--border-hover)` | `.kh-icon-btn:hover` | ✓ |
| 184 | `color:#ED4245; border-color:#ED4245` | `.kh-logout-btn:hover` | ✓ |
| 203 | `border-color:var(--accent-ink); box-shadow:0 0 0 3px rgba(245,166,35,0.12)` | `.kh-search-input:focus` | ✓ |
| 208 | `border-color:var(--border-hover)` | `.kh-chip:hover` | ✓ |
| 219 | `border-color:var(--border-hover)` | `.kh-result-card:hover` | ✓ |
| 236 | `color:#5865F2` | `.kh-discord-link:hover` | ✓ |
| 264 | `border-color:var(--border-hover)` | `.kh-chip:hover` (shared) | ✓ |
| 269 | `color:var(--tx); border-color:var(--border-hover)` | `.kh-mark-all:hover` | ✓ (rename `--text-primary`→`--tx`) |
| 271 | `border-color:var(--border-hover)` | `.kh-unread-toggle:hover` | ✓ |
| 283 | `background:var(--hover-row)` | `.kh-doc-row:hover` | ✓ |
| 303 | `border-color:#5865F2; color:#5865F2` | `.kh-doc-link:hover` | **D3 — change amber→blurple** |
| 330 | `border-color:var(--accent-ink); color:var(--accent-ink)` | `.kh-load-more:hover` | ✓ |
| 460 | `transform:translateY(-2px)` | `.kh-chat-fab:hover` | ✓ |
| 479/482 | `color:var(--accent-ink); border-color:var(--border-hover)` | `.kh-chat-header-btn:hover` | ✓ |
| 485 | `color:#ED4245; border-color:#ED4245` | `.kh-chat-header-btn--danger:hover` | ✓ |
| 496 | `background:var(--hover)` | `.kh-chat-history-item:hover` | ✓ |
| 518 | `border-color:var(--accent-ink); color:#fff` | `.kh-chat-suggestion:hover` | ✓ **keep `--tx`, NOT `#fff`** (D5) |
| 573 | `border-color:#5865F2` | `.kh-chat-citation:hover` | ✓ |
| (204 login) | `background:#4853e0; transform:translateY(-1px)` + `style-active:transform:translateY(0)` | `.kh-discord-btn` | see D6 (optional `:active`) |

### Files to touch (exhaustive — 12 files) and why

| File | Refs | Change |
|---|---|---|
| `styles/global.css` | 3 + token defs | Token block rewrite (Task 1) |
| `styles/components.css` | 8 + doc-link | Rename + D3 (Task 3) |
| `components/SearchView.tsx` | 17 | inline `var(--tx*)` rename |
| `components/ChatWidget.tsx` | 19 | inline rename |
| `components/StatsView.tsx` | 20 | inline rename |
| `components/DocsView.tsx` | 16 | inline rename |
| `components/LoginScreen.tsx` | 6 | inline rename |
| `components/Header.tsx` | 4 | inline rename |
| `components/Sidebar.tsx` | 3 | inline rename |
| `components/DocsView.test.tsx` | 2 | assertion strings `'var(--tx)'` |
| `tests/*.spec.ts` (5 files) | comments | stale `// --text-…` → `// --tx…` (values unchanged) |
| `tests/README.md` | 1 | doc note `--text-*` → `--tx*` |

Total inline/CSS token refs = 98 (85 tsx + 8 components.css + 3 global.css + 2 test assertions),
matching the tree grep. `--dot-read` is **defined but not yet consumed** — it is unused in the design
markup too (the DocsView "read" state uses a checkmark `stroke:var(--tx5)` at design line 290, and the
row accent is an inline amber `box-shadow` at line 287). Adding the token is spec-alignment only; **do
not rewire DocsView to use it** in this story.

### Decisions (ratified defaults — flagged for Borja's review at PR)

- **D1 — Rename `--text-*` → `--tx*` (adopt the design's canonical names).** The epic text explicitly
  lists the `--tx2…--tx5` scale as the target ("escalas `--tx2…--tx5`"), and 11.2–11.4 will copy the
  design's responsive markup verbatim (it references `var(--tx…)`); matching names lets them paste 1:1
  with no translation. *Trade-off accepted:* `--text-primary` is more self-documenting than `--tx`, but
  the mock-verbatim house discipline + the downstream-copy benefit win. Zero visual impact.
- **D2 — Add `--dot-read` (both themes) even though currently unconsumed.** It is in the design's token
  block and named in the epic. Reserved token; DocsView is not rewired.
- **D3 — `.kh-doc-link:hover` → blurple `#5865F2` (was amber `--accent-ink`).** The web deviated from
  the design here in Story 8.1; the design (HEAD and current) specifies blurple for the "Ver en
  Discord" link, consistent with every other Discord link (`.kh-discord-link`, `.kh-doc-link` sibling,
  `.kh-chat-citation`). This is the **only** intentional visual change in the story and it touches the
  `done` DocsView — flag for review. *If Borja prefers to keep amber for accent consistency, revert this
  one line; everything else stands.*
- **D4 — Dark selector `:root` → `:root, [data-kh="dark"]`.** Matches the design. Functionally
  equivalent (dark is the default via `:root`), but explicit and future-proof.
- **D5 — Keep the two ratified web deviations, do NOT revert to bare mock:**
  (a) `.kh-chat-suggestion:hover` uses the token (`--tx`) instead of the design's hardcoded `#fff` —
  `#fff` is illegible on the light theme (documented in components.css);
  (b) the extra `:focus-visible` outlines web adds for keyboard accessibility (Epic 4 retro AI#4/#5) —
  the design has no `:focus-visible` states; these are a deliberate a11y superset and stay.
- **D6 — (Optional, low priority) Add `.kh-discord-btn:active { transform: translateY(0); }`** to match
  the design's `style-active` on the login button (resets the lift while pressed). Nice-to-have; skip if
  it adds risk. Not required for any AC.

### Why the visual harness stays green (do not skip this reasoning)

The E2E visual specs (`tests/*.spec.ts`) assert **computed `rgb(...)` strings**, e.g.
`const TEXT_PRIMARY = 'rgb(230, 233, 239)'`. Those rgb values are the resolved `--tx`/`--text-primary`
color and are **unchanged** by a rename. The `// --text-primary` text next to them is a **comment**.
So: baselines don't move, assertions don't change, harness stays green. The only functional test edit
is `DocsView.test.tsx`, which asserts the literal inline variable string (`'var(--text-primary)'`) — a
name, so it must become `'var(--tx)'`. The D3 blurple change is on `:hover` (not captured by the
static-state visual baselines or the unit assertions), so it too leaves the harness green; verify it by
eye / in 11.5's extended harness.

### Architecture & guardrails

- **Frontend-only, `packages/web` exclusively.** AD-3 (static SPA — no server, no per-device build) and
  AD-6 (no contract touched) stay intact. No Drizzle/Zod/API/SSE change. No new dependency.
  [Source: _bmad-output/planning-artifacts/epics.md#Épico-11; sprint-change-proposal-2026-07-13-responsive-refresh.md#2]
- **No raw hex outside the sanctioned allowlist.** The only raw hex touched here is `#5865F2` (D3),
  which is the already-sanctioned Discord brand color. Everything else references tokens.
  [Source: packages/web/src/styles/global.css#1-17 header comment]
- **English only** in all code/comments/tests/commits. [Source: project-context.md#Code quality & naming]
- **One story at a time; branch first.** `git switch -c feat/11-1-refresh-design-tokens` off the current
  HEAD; never commit on `main`. Conventional Commits, scope `web`.
  [Source: project-context.md#Development workflow]

### Project Structure Notes

- Components live in `packages/web/src/components/` (there is **no** `views/` directory — despite the
  epic prose saying "vistas", `SearchView`/`DocsView`/`StatsView` are files under `components/`).
- Stylesheets: `packages/web/src/styles/{global,components}.css` are the only two CSS files in `src/`
  (`dist/` is build output — ignore). React inline styles hold static layout; `:hover`/`:focus` live in
  `components.css` because inline styles can't express pseudo-classes.
- **Cascade gotcha (Epic 4 retro AI#4), still applies:** any property that changes on `:hover`/`:focus`
  must have its BASE value declared in `components.css`, not inline — an inline shorthand outranks a
  stylesheet pseudo-class rule and silently kills the hover. This story doesn't move any base value
  between inline and CSS, so the existing structure is preserved; just don't introduce new inline bases.

### Previous story intelligence (10.2 → 11.1)

- **10.2 (i18n) is done.** It extracted ~31 literals to `locales/{es,en}.json` and wired
  `react-i18next` with static import + synchronous init (no FOUC). 11.1 does not touch i18n; the
  components it edits now render translated strings via `t(...)` — leave those calls untouched, only
  swap `var(--text-*)` → `var(--tx*)` in the `style={{…}}` objects.
- **Epic 10 review pattern:** 3 adversarial layers (Blind/Edge/Auditor) at Opus; the gate is
  lint + unit(web) + build + 28 e2e. Expect the same review rigor here. The Auditor will diff every
  token reference — a single missed `--text-*` will be flagged (AC2 grep is the guard).
- **Established defaults-flagged-for-review pattern** (9.2 had "6 ratified defaults"): decisions D1–D6
  above follow it — safe defaults chosen, each reversible, surfaced for Borja at PR.

### Testing

- **Unit (Vitest):** only `DocsView.test.tsx` changes (2 token-name assertions). All other unit tests
  are value-based or structural and must stay green untouched.
- **E2E visual (Playwright, existing dark-desktop harness):** must pass with **zero baseline churn**.
  If any snapshot diffs, a value was changed by mistake — stop and audit.
- **No integration run needed** (web-only, no shared/backend touch) — mirrors the 9.2/10.2 precedent.
- New mobile + light-theme visual coverage is **11.5's** job, deferred by name.
  [Source: project-context.md#Testing rules; epics.md#Historia 11.5]

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Épico-11 · Historia-11.1] — epic goal, story scope,
  binding sequence, explicit `--tx2…--tx5` + `--dot-read` token list, FR27.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-responsive-refresh.md] —
  Moderate classification, AD-3/AD-6 intact, frontend-only, no new dependency, risk Low.
- [Source: docs/context/design/Share2Brain Web.dc.html#34-45] — canonical token block (dark + light).
- [Source: docs/context/design/Share2Brain Web.dc.html · lines 74–573] — all 22 `style-hover`/`style-focus` states.
- [Source: packages/web/src/styles/global.css] — current token block (`--text-*`, no `--dot-read`).
- [Source: packages/web/src/styles/components.css] — current interaction states + cascade-fix comments.
- [Source: packages/web/tests/*.spec.ts] — rgb constants annotated with old token names (comments only).
- [Source: docs/frontend-standards.md] — UI/UX standards, raw-hex policy, token discipline.
- [Source: docs/context/ARCHITECTURE-SPINE.md] — AD-3 (static SPA), AD-6 (contracts in shared).

## Review Findings

_bmad-code-review 2026-07-13 — 3 adversarial layers @ Opus 4.8 (Blind Hunter / Edge Case Hunter / Acceptance Auditor). Diff vs baseline 8674626 (packages/web only, +126/−125). Edge Case Hunter returned airtight (0 findings); Acceptance Auditor confirmed AC1–AC5 SATISFIED and D1–D6 implemented as ratified._

- [x] [Review][Decision] `.kh-doc-link:hover` blurple (`#5865f2`) vs amber (`var(--accent-ink)`) — **RESOLVED (Borja, 2026-07-13): keep blurple.** Design-canonical, coherent with every sibling Discord link (`.kh-discord-link`, `.kh-chat-citation`); `#5865f2` is on the sanctioned Discord-brand allowlist. Blind Hunter's "not theme-aware" concern was refuted (blurple is fixed across themes exactly like the sibling Discord links). No change — implementation stands. [packages/web/src/styles/components.css:137-138]
- [x] [Review][Defer] AC3↔AC4 wording tension — AC4 says "ZERO changes to any color assertion" while AC3 mandates the D3 hover-color change asserted in `docs.spec.ts`. Code resolution (favor AC3) is correct; this is a spec-text imprecision only, not a code defect. Deferred — tighten AC4 wording to carve out D3 in future stories. [_bmad-output/implementation-artifacts/11-1-web-refresh-design-tokens-estados-interaccion.md#AC4]

**Dismissed as noise (4):** (1) hex casing `#5865f2` lowercase in CSS vs `#5865F2` in comments/tests — deliberate per D3 (matches the file's existing `.kh-discord-link`/`.kh-chat-citation` casing), same rgb. (2) `--dot-read` unconsumed — D2 reserved token by design; DocsView deliberately not rewired. (3) incomplete-rename risk — Edge Case Hunter grepped `packages/web/{src,tests}`: **0** surviving `--text-*`, every `--tx*` resolves to a defined token, both `.css` files covered. (4) dark selector `:root` → `:root, [data-kh="dark"]` — D4 spec-mandated (AC1), verified cascade-benign (light block still wins by source order).

### Review Findings — second pass (2026-07-13, extra scrutiny, identical diff)

_Re-ran all 3 layers on the unchanged diff. Auditor + Edge Case Hunter re-confirmed the first-pass conclusion (AC1–AC5 SATISFIED, D1–D6 as ratified, rename byte-exact, cascade sound). This pass widened the grep beyond `packages/web` and surfaced ONE genuine new finding the first pass missed._

**Re-review #2 (third pass, 2026-07-13): CONVERGED — 0 new findings.** Focused convergence-breaker re-verified the just-applied docs patch (both lines correct, Story-2.1 history note fixed, no phantom `--tx*`), ran `tsc -p packages/web` (exit 0) + `DocsView.test.tsx` (21/21), and confirmed remaining `--text-*` refs live only in historical `_bmad-output/` artifacts + the design snapshot (correctly out of scope). `--dot-read` + all `--tx*` values byte-exact vs design. Review fully converged.

- [x] [Review][Patch] APPLIED (2026-07-13) — Standards docs still reference the old `--text-*` token names after the rename — `docs/` is the source of truth (CLAUDE.md), so a rename that invalidates a standards doc must update it. Two lines: `docs/frontend-standards.md:205` ("Use the real token names (`--text-primary/-muted/-subtle`)") and `docs/bmad-story-mandatory-steps.md:110` ("use the real token names (`--text-primary/-muted/-subtle`, renamed in Story 2.1 from `--tx/--tx4/--tx5`)" — now doubly inverted: 11.1 renamed BACK to `--tx*`). Task 6's "no frontend-standards.md change needed" assessment was incorrect. Fix: `--text-primary/-muted/-subtle` → `--tx/--tx4/--tx5` and correct the Story-2.1 history note. [docs/frontend-standards.md:205, docs/bmad-story-mandatory-steps.md:110]

**Dismissed as noise (second pass, 7):** (1) `.kh-doc-link`/`.kh-resource-link` CSS comments "now lie" (Blind) — misread: "mirrors .kh-resource-link" describes the base-not-inline **cascade pattern** (still true), and "Amber hover, unlike the blurple links above" is still literally accurate. (2) hover-blurple + `:focus-visible`-amber "inconsistency" — the amber focus ring is the app-wide keyboard-a11y convention (D5), independent of hover color. (3) light-theme contrast of fixed `#5865f2` — identical to every pre-existing sibling Discord link (`.kh-discord-link`, `.kh-chat-citation`); Borja ratified blurple. (4) `[data-kh="dark"]` redundant/dead — D4 spec-mandated, verified harmless (only `<html>` ever gets `data-kh`). (5) `ACCENT_INK` unused in `docs.spec.ts` — FALSE POSITIVE, still used at lines 55/62/89 (unread dot/badge). (6) Completion-Notes count imprecision ("98 refs"; components.css 7-not-8; global.css 1-value-ref-not-3) — self-reported bookkeeping, no AC depends on it. (7) `DISCORD_BLURPLE` comment naming drift ("Ver recurso" vs "Ver en Discord") — cosmetic nit.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story)

### Debug Log References

- E2E harness first run failed to boot: `e2e:server` requires `DATABASE_URL` + `REDIS_URL`
  (no default fallback, audit L-6). Re-ran with `DATABASE_URL` → local Docker Postgres :5432 and
  `REDIS_URL=redis://127.0.0.1:6379` (Homebrew Redis, per tests/README.md "Redis note (this Mac)").
- E2E first pass: 27 passed / **1 failed** — `docs.spec.ts:143` asserted `.kh-doc-link` hover =
  `ACCENT_INK` (amber). This is exactly the D3 target. Updated the assertion to `DISCORD_BLURPLE`
  (`rgb(88, 101, 242)` = `#5865F2`); re-run → 28 passed.

### Completion Notes List

Token realignment `--text-*` → `--tx*` (98 refs) + reserved `--dot-read` token + dark selector
`:root` → `:root, [data-kh="dark"]` + D3 interaction fix (`.kh-doc-link:hover` amber → Discord
blurple). All 5 ACs satisfied. Frontend-only, `packages/web` exclusively; no shared/backend/workers/
bot, no Drizzle/Zod/API/SSE change, no new dependency (AD-3 + AD-6 intact).

**One deviation from the story's written plan (flag for review):** the story's "Why the visual harness
stays green" section asserted the D3 blurple change was on `:hover` and therefore *not* captured by the
E2E harness ("verify it by eye / in 11.5's extended harness"). That was inaccurate — `docs.spec.ts`
(Story 7.6 coverage) **does** hover `.kh-doc-link` and assert its color/border-color. So D3 required one
E2E assertion update (`ACCENT_INK` → new `DISCORD_BLURPLE` constant + comment). This is consistent with
AC3 (which explicitly mandates D3) and is the same category of change as the sanctioned
`DocsView.test.tsx` name-assertion edit — a test encoding the pre-change behavior. The token *rename*
still caused **zero** assertion churn, exactly as designed.

**Decisions D1–D6 status:** D1 (rename), D2 (`--dot-read` reserved/unconsumed), D3 (doc-link blurple),
D4 (dark selector), D5 (kept both ratified web deviations — `.kh-chat-suggestion` `--tx` and the extra
`:focus-visible` a11y outlines) all implemented as ratified. **D6 (optional `.kh-discord-btn:active`
lift-reset) SKIPPED** — explicitly optional, not required by any AC, kept out to preserve zero-risk scope.
D3 remains flagged for Borja's review at PR (touches the `done` DocsView; revert one line to keep amber
if preferred). Blurple hex written lowercase `#5865f2` to match the file's existing convention.

**Verification gate (agent-run, repo-wide):**
- `npm run lint` → clean (eslint, 0 problems).
- `npm run test` → **1073 passed | 1 skipped** (103 files), no regressions.
- `npm run build` → all 5 packages build clean (backend/bot/shared/workers `tsc --noEmit`; web
  `vite build` ✓ 166 modules).
- E2E visual harness (`test:e2e`, Chromium, dark, desktop) → **28 passed**; only the D3 hover
  assertion changed, zero token-rename churn.
- `git diff --name-only <baseline> -- packages/` → `web` only.

### File List

Modified (all under `packages/web`):
- `src/styles/global.css` — token block: dark selector, `--text-*`→`--tx*` renames (both themes),
  `--dot-read` added (both themes), `body` color ref.
- `src/styles/components.css` — 8 `--text-*` refs → `--tx*`; D3 `.kh-doc-link:hover` amber → `#5865f2`;
  chat-suggestion comment updated.
- `src/components/SearchView.tsx` — inline `var(--tx*)` renames (17).
- `src/components/ChatWidget.tsx` — inline renames (19).
- `src/components/StatsView.tsx` — inline renames (20).
- `src/components/DocsView.tsx` — inline renames (16).
- `src/components/LoginScreen.tsx` — inline renames (6).
- `src/components/Header.tsx` — inline renames (4).
- `src/components/Sidebar.tsx` — inline renames (3).
- `src/components/DocsView.test.tsx` — 2 token-name assertion strings → `'var(--tx)'`.
- `tests/docs.spec.ts` — new `DISCORD_BLURPLE` constant + D3 hover assertion update; rgb-constant
  comments retagged to `--tx*`.
- `tests/analytics.spec.ts`, `tests/search.spec.ts`, `tests/chat.spec.ts`, `tests/auth-guest.spec.ts`
  — rgb-constant trailing comments retagged `--text-*` → `--tx*` (values unchanged).
- `tests/README.md` — spec-authoring note updated to the `--tx*` naming.

### Change Log

- 2026-07-13 — Implemented story 11.1: web design-token realignment `--text-*` → `--tx*` (98 refs),
  reserved `--dot-read` token (both themes), dark selector `:root` → `:root, [data-kh="dark"]`, and
  D3 `.kh-doc-link:hover` amber → Discord blurple `#5865f2`. Updated 1 E2E hover assertion for D3
  (beyond the story plan — see Completion Notes). Gate green (lint / 1073 unit+web / build 5 pkgs /
  28 e2e). Frontend-only, `packages/web` exclusively; AD-3 + AD-6 intact; no new dependency.

---

_Ultimate context engine analysis completed — comprehensive developer guide created. Fresh-context
finding: 11.1 is a token-name realignment (web `--text-*` → design-canonical `--tx*`) + one reserved
token (`--dot-read`) + one genuine interaction fix (doc-link hover amber→blurple, D3); the design's
token/interaction layer did not otherwise change vs HEAD, and color values are byte-identical so the
existing visual harness stays green with zero baseline churn._
