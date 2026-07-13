# Sprint Change Proposal — Responsive & Visual Refresh of the Web SPA

- **Date:** 2026-07-13
- **Author / navigator:** Borja (via `bmad-correct-course`)
- **Trigger artifact:** `docs/context/design/Share2Brain Web.dc.html` (updated, **+1126 / −190** lines)
- **Scope classification:** **Moderate** (frontend-only, additive, no contract/schema/backend/MVP change)
- **Mode:** Incremental (each decision confirmed with Borja before drafting)

---

## 1. Issue Summary

**Problem statement.** The design spec `Share2Brain Web.dc.html` — the authoritative, mock-verbatim
source the web stories were built against — was rewritten to (a) polish the visuals and (b) introduce
a **responsive layout system that did not exist before**. The current `packages/web` implementation is
**desktop-only**: the only `@media` rule in the whole package is `prefers-reduced-motion`. There is no
`matchMedia`, no breakpoint, no mobile navigation. On a phone the app is unusable (fixed 236px sidebar,
no bottom nav, chat FAB overlapping content).

**Trigger.** Stakeholder (Borja) design update, post-roadmap (Epics 1–10 done). Not triggered by any
story failing — it is a refinement of the UX spec that all completed web views must now conform to.

**Evidence.**

- Design diff: **+1126 / −190** lines. Responsive markers in the spec went from **0 → full**:
  `isMobile` ×12, `isDesktop` ×5, `matchMedia` ×2, a mobile bottom-nav block, `safe-area-inset`,
  dynamic `headerPad`/`contentPad`, and chat FAB repositioning (`chatBottom`/`chatRight`). The old
  (HEAD) version had none of these.
- `packages/web/src`: `grep -rniE "matchMedia|@media|isMobile|breakpoint"` → **1 hit**
  (`global.css` `prefers-reduced-motion` only). The UI is desktop-only.
- PRD + `epics.md`: `grep -niE "responsive|móvil|mobile|tablet|breakpoint"` → **0 hits**. Responsive
  was never a written requirement.
- `docs/frontend-standards.md:191` **already states** "**Responsive** layouts; relative units;
  images `max-width: 100%`" — the standard existed but was never realized, because the design was
  desktop-only and no story ever defined a breakpoint or a mobile navigation pattern.
- The design's `:root` design-token palette was expanded/refined (new `--line`, `--border-hover`,
  `--dot-read`, `--tx2…--tx5`, light + dark) plus new `hover`/`focus` interaction states throughout —
  a systemic visual change touching `global.css` and every component.
- E2E visual harness (Playwright, stories 4-5 / 7-6 / 9-3) verifies views against the design but runs
  **Chromium, dark theme, desktop viewport only**.

**Ratified decisions (Borja, 2026-07-13).**

1. **Scope = Responsive + full visual re-skin** (adopt the whole updated design: responsive + refreshed
   token palette + hover/focus states across all already-done views).
2. **Structure = new additive Épico 11** (per the Épico 8/9/10 correct-course precedent), not reopening
   individual done stories.
3. **E2E harness = extend to mobile + desktop × light + dark** (full coverage of the new design).

---

## 2. Impact Analysis

### Epic impact

No epic is invalidated; the change is **purely additive** over delivered work. Every screen in the
design is already implemented and `done`:

| Design screen | Story(ies) | Status |
|---|---|---|
| Login + guest | 2-2, 2-5 | done |
| Search | 4-3, 7-5 | done |
| Documents | 4-4, 8-1, 8-2 | done |
| Statistics | 9-2, 9-5 | done |
| Chat (FAB + panel + SSE) | 5-3, 5-4 | done |
| i18n | 10-2 | done |
| E2E visual harness | 4-5, 7-6, 9-3 | done |

A **new Épico 11** captures the responsive + visual-refresh work. No resequencing of existing epics.

### Story impact

- **No existing story is rolled back or reopened.** The done views remain functionally correct; they
  are re-skinned and made responsive by the new epic's stories, layer by layer.
- New stories **11.1 – 11.5** (see §4).

### Artifact conflicts

- **`epics.md`** — needs the new **FR27** (responsive UI) in the requirement inventory + a new **Épico
  11** section + a "Lista de Épicos" entry.
- **`docs/frontend-standards.md`** — the "Responsive" bullet is aspirational; it must be sharpened with
  the concrete breakpoint (760px), the sidebar↔bottom-nav pattern, and the E2E mobile-viewport rule.
- **`docs/context/TECHNICAL-DESIGN.md` §5.5** — the `packages/web` section describes 5 views but says
  nothing about responsive behavior; add a "Responsive (Épico 11)" paragraph.
- **E2E harness** — must gain a mobile viewport and a light-theme run.
- **PRD** — responsive is **not** listed as a no-objetivo, so nothing must be *removed*; an optional
  one-line roadmap note records the delivery.

### Technical impact

- **Frontend-only.** `packages/web` exclusively. **Zero** change to the Drizzle schema, Zod contracts,
  API/SSE shapes, backend, workers, or bot.
- **Invariants intact:** **AD-3** (SPA stays static — responsiveness is pure client CSS/JS, no server,
  no rebuild-per-device), **AD-6** (no contract touched). **No new runtime dependency** — a
  `useIsMobile` hook over `window.matchMedia('(max-width: 760px)')` is enough (matches the design's own
  mechanism). No DDL, no migration.
- **Risk: Low.** The only regression surface is CSS/layout; the extended E2E harness (mobile + light)
  is the safety net.

---

## 3. Recommended Approach

**Selected path: Option 1 — Direct Adjustment (Hybrid)** — add a new epic + 5 stories within the
existing plan; extend the E2E harness rather than replace it.

**Rejected alternatives.**

- *Rollback* — nothing to roll back; the done views are correct, just desktop-only. Reverting would
  destroy value for no gain.
- *MVP review* — MVP is unaffected; this is additive polish on a closed roadmap.

**Rationale.** Post-roadmap, additive, zero-invariant-change work — the exact profile of Épicos 8, 9
and 10, all added via `correct-course`. The layered inner-first split (tokens → responsive shell →
views/chat → E2E) mirrors the house workflow (schema/foundation first, adapters/UI later, tests last).
Extending the existing visual harness to mobile × light gives objective sign-off on the whole new design.

---

## 4. Detailed Change Proposals

### P1 — `_bmad-output/planning-artifacts/epics.md`

**Add to the requirement inventory (FR list):**

```
FR27 — La UI web es responsive: usable en móvil y tablet además de desktop. Breakpoint 760px;
navegación adaptativa (sidebar en desktop, barra inferior fija en móvil con badge de no-leídos);
sin scroll horizontal del body; respeta `safe-area-inset`.
```

**Add a new epic after Épico 10** (as a detailed section at the end of the file — the "Lista de
Épicos" summary is **not** extended, matching the Épico 8/9/10 correct-course precedent which only
covers the original roadmap epics 1–7):

```markdown
## Épico 11: Responsive & Refresh Visual del Diseño Web

**Goal:** Alinear `packages/web` con la versión actualizada de `Share2Brain Web.dc.html`: soporte
responsive (breakpoint 760px, barra de navegación inferior en móvil, header/padding/chat adaptativos,
`safe-area-inset`) + refresh de la paleta de design tokens y estados hover/focus sobre las vistas ya
entregadas. Frontend-only (AD-3 intacto); sin cambios de contrato, schema ni backend (AD-6 intacto).

**FRs cubiertos:** FR27 (nuevo)

> Aprobado via `bmad-correct-course` (2026-07-13,
> `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-13-responsive-refresh.md`),
> clasificación **Moderate**. Trigger: el diseño actualizado introduce un sistema responsive completo
> (antes 0) + una paleta de tokens refinada; la implementación web era solo-desktop (único `@media` =
> `prefers-reduced-motion`). Realiza el estándar "Responsive layouts" (`frontend-standards.md`) que
> hasta ahora no tenía spec que lo respaldara. Sin dependencia nueva (`useIsMobile` sobre `matchMedia`).
> Las ACs Gherkin completas y las UX-DR nuevas se detallan al crear cada historia vía
> `bmad-create-story`. Secuencia binding: 11.1 → 11.2 → (11.3 ∥ 11.4) → 11.5.

- **Historia 11.1 · web — Refresh de design tokens y estados de interacción.** Actualizar la paleta de
  custom properties en `global.css` (`:root`/`[data-kh]` para dark + light: nuevos `--line`,
  `--border-hover`, `--dot-read`, escalas `--tx2…--tx5`, etc.) al spec nuevo, y los estados
  `hover`/`focus` de los primitivos (chips, cards, botones, filas) en `components.css`. Capa
  fundacional. Sin regresión visual desktop de las vistas existentes en ambos temas.
- **Historia 11.2 · web — Hook `useIsMobile` + shell responsive (AppLayout + Header).** `useIsMobile`
  sobre `window.matchMedia('(max-width: 760px)')` (listener add/remove, SSR-safe). `AppLayout`: sidebar
  visible solo en desktop; en móvil **barra inferior fija** (62px + `safe-area-inset-bottom`, con badge
  de documentos no-leídos). `Header`: logo hexágono en móvil; oculta stats-line + pill "indexando en
  vivo" + nombre de usuario en móvil; `headerPad`/`contentPad` dinámicos. Depende de 11.1.
- **Historia 11.3 · web — Adaptación responsive de las vistas (Search / Docs / Stats).** Aplicar
  `contentPad`; DocsView con scroll horizontal contenido (`overflow-x` sobre `min-width`, no del body);
  grids auto-fit de Stats verificados/afinados; inputs y max-width fluidos en Search; nueva paleta
  aplicada. Usable a 360px sin scroll horizontal del body. Depende de 11.2.
- **Historia 11.4 · web — Chat widget responsive (FAB + panel).** FAB reposicionado sobre la barra
  inferior en móvil (`chatBottom:78px`/`chatRight:16px` vs `24/24` desktop); panel
  `max-width:calc(100vw-32px)`, `max-height:calc(100vh-48px)`, animación `kh-pop`; el FAB no tapa la
  bottom-nav. Depende de 11.2; paralelizable con 11.3.
- **Historia 11.5 · web/e2e — Extender el harness visual a móvil + tema claro.** Añadir un viewport
  móvil (≤760px, p.ej. 390×844) y una ejecución en tema **claro** además del desktop/oscuro actual;
  baselines nuevas para login, search, docs, stats y chat en las combinaciones móvil×claro/oscuro y
  desktop×claro. Suite verde. Depende de 11.1–11.4.
```

**Rationale:** post-roadmap addition following the Épico 8/9/10 precedent; layered inner-first
sequence. No DDL, no new AD, no new dependency.

### P2 — `docs/frontend-standards.md` (line 191, "UI/UX Standards")

**Before:**

```
- **Responsive** layouts; relative units; images `max-width: 100%`.
```

**After:**

```
- **Responsive** layouts; relative units; images `max-width: 100%`. Breakpoint **760px**
  (`useIsMobile` over `window.matchMedia`): desktop shows the 236px sidebar; mobile hides it and shows
  a fixed bottom navigation bar (respect `safe-area-inset-bottom`). The body must never scroll
  horizontally — wide content (e.g. the Documents table) scrolls inside its own `overflow-x` container.
  E2E visual checks run at **both** a mobile and a desktop viewport, in **both** light and dark themes.
```

**Rationale:** turns the aspirational bullet into an enforceable rule so no future web story ships
desktop-only again.

### P3 — `docs/context/TECHNICAL-DESIGN.md` §5.5 (`packages/web`)

Add a paragraph next to the "Internacionalización (Épico 10)" note:

```
**Responsive (Épico 11):** la SPA es responsive con un único breakpoint a 760px, resuelto en cliente
vía `useIsMobile` sobre `window.matchMedia` (sin dependencia nueva, AD-3 intacto — sigue siendo un
build estático). En desktop se muestra la sidebar de 236px; en móvil se oculta y aparece una barra de
navegación inferior fija (con `safe-area-inset-bottom` y badge de no-leídos), el header colapsa a
logo + acciones, el padding de contenido se reduce y el FAB de chat se reposiciona sobre la barra
inferior. La paleta de design tokens (`:root`/`[data-kh]`) y los estados hover/focus siguen el spec
`docs/context/design/Share2Brain Web.dc.html`.
```

**Rationale:** documents the responsive behavior where the web architecture is described; explicitly
reaffirms AD-3 and "no new dependency".

### P4 — `_bmad-output/implementation-artifacts/sprint-status.yaml` (mandatory, checklist 6.4)

Add after the Épico 10 block, in `development_status`:

```yaml
  # ── Épico 11: Responsive & Refresh Visual del Diseño Web ────────────────────
  # Added 2026-07-13 via bmad-correct-course (sprint-change-proposal-2026-07-13-responsive-refresh.md):
  # the updated design Share2Brain Web.dc.html introduces a full responsive system (breakpoint 760px,
  # mobile bottom-nav, adaptive header/padding/chat, safe-area) — 0 before — plus a refreshed design-
  # token palette + hover/focus states. Web impl was desktop-only (only @media = prefers-reduced-motion).
  # Frontend-only, Moderate. No schema/contract/backend (AD-3 + AD-6 intact). No new dependency
  # (useIsMobile over matchMedia). New FR27. Binding sequence: 11-1 -> 11-2 -> (11-3, 11-4) -> 11-5.
  epic-11: backlog
  11-1-web-refresh-design-tokens-estados-interaccion: backlog
  11-2-web-useismobile-shell-responsive-applayout-header: backlog
  11-3-web-adaptacion-responsive-vistas-search-docs-stats: backlog
  11-4-web-chat-widget-responsive-fab-panel: backlog
  11-5-web-e2e-harness-visual-movil-tema-claro: backlog
  epic-11-retrospective: optional
```

**Rationale:** registers the additive epic + 5 stories at `backlog`; `bmad-create-story` will promote
them to `ready-for-dev` one at a time.

### P5 — `docs/context/PRD.md` (optional)

Responsive is **not** a no-objetivo, so no exclusion is removed. Optionally record delivery in the
roadmap section. **Low priority** — can be skipped without affecting the plan.

---

## 5. Implementation Handoff

- **Change scope:** **Moderate** → backlog reorganization (PO/DEV).
- **Immediate actions on approval:**
  1. Apply P1 (epics.md), P2 (frontend-standards), P3 (TECHNICAL-DESIGN §5.5), P4 (sprint-status.yaml).
  2. `bmad-create-story 11-1` → `bmad-dev-story` → review, one story at a time, in the binding sequence.
- **Handoff recipients:** Developer agent (`bmad-create-story` / `bmad-dev-story` / `bmad-code-review`).
- **Success criteria:** all 5 views usable at 360px with no body horizontal scroll, in light + dark;
  E2E visual harness green at mobile + desktop × both themes; zero backend/contract change; verification
  gate (`lint && test && build`) green.
