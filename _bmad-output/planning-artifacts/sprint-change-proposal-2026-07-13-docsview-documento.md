# Sprint Change Proposal — DocsView unified "Documento" column

- **Date:** 2026-07-13
- **Author:** Borja (via `bmad-correct-course`)
- **Classification:** Moderate (reopens a done epic; frontend-only, no schema/contract/backend)
- **Mode:** Incremental
- **Related design source:** `docs/context/design/Share2Brain Web.dc.html` (modified)

---

## Section 1 — Issue Summary

The **Documentos** view currently renders the indexed-resource table with a **6-column grid**
where `título` and `descripción` are **separate cells** (established by Story 8.1).

The updated design mock (`docs/context/design/Share2Brain Web.dc.html`) merges those two columns
into a single **"Documento"** column: the **title** sits on the first line (with the **"Nuevo"**
badge when the row is unread) and the **description** sits directly beneath it in secondary text.
This aligns the Documentos table row with the pattern already used by the Búsqueda result cards
(UX-DR11: title stacked over description).

Discovered while refining the design after Story 8.1. This is a **design refinement** (new
requirement), not a defect. No data or behavior changes — only the presentation of already-served
fields (`title`, `description`, `link` remain on the `DocumentFragment` contract).

---

## Section 2 — Impact Analysis

### Epic impact — none structural
- No epic is invalidated, resequenced, or made obsolete.
- Fits as **Historia 8.2** under **Épico 8 (UX Polish)**, which reopens `done → in-progress`.
  Same pattern and precedent as Story 8.1.

### Story impact
- **New:** Historia 8.2 (this change).
- **Superseded detail:** Story 8.1's 6-column layout is refined to 5 columns.

### Artifact conflicts
| Artifact | Impact | Notes |
|---|---|---|
| PRD (FR12/FR16/FR17) | **None** | Describe *data* (title+description+link), not layout. MVP intact. |
| Architecture (SPINE / TECHNICAL-DESIGN) | **None** | No AD touched; no data model, API, or Zod change. `DocumentFragment` unchanged. |
| UX (epics.md UX-DR12, UX-DR13) | **Update** | Core of the change — 6→5 columns, merged `documento` cell. |
| i18n locales (`es.json`, `en.json`) | **Update** | Column header keys. |
| Tests (`DocsView.test.tsx`, `docs.spec.ts`) | **Update** | Grid tracks, header label, testid placement. |
| Deploy / IaC / CI / backend | **None** | — |

### Technical impact
- Frontend-only. AD-3 (static SPA) intact. No migration, no contract break, no backend edit.
- **Pre-existing note (out of scope):** the Gherkin AC of *Historia 4.4* in `epics.md` was already
  stale after Story 8.1 (still says "chunk / 4 cols / `--dot-read`"). Not corrected here unless
  requested; UX-DR12/UX-DR13 are the authoritative spec.

---

## Section 3 — Recommended Approach

**Option 1 — Direct Adjustment (SELECTED).** Add a small follow-on story (8.2) under the existing
Épico 8 and refine UX-DR12/UX-DR13; implement the presentation change in the web package.

- Effort: **Low** · Risk: **Low**.
- **Option 2 (Rollback):** not viable/unnecessary — nothing to revert; 8.1's states/handlers are kept.
- **Option 3 (MVP review):** N/A — MVP unaffected.

Rationale: the change is a contained re-skin of one component (mirrors Story 8.1's own scope),
reuses existing handlers/effects/testids, and harmonizes DocsView with the SearchView card pattern.

### Design decision (confirmed with Borja)
- **Title:** clamp-2 (unchanged from 8.1); **Description:** clamp-2 below, `--tx3`. Stacked in the
  same cell. Minimizes churn to existing E2E clamp assertions.

---

## Section 4 — Detailed Change Proposals

### 4.1 — `epics.md` · UX-DR12 (table header)
```
OLD: … Header tabla: grid 6 cols (`título / descripción / link / canal / autor / indexado`) …
NEW: … Header tabla: grid 5 cols (`documento / link / canal / autor / indexado`) …
     + change-note: "Historia 8.2 — título y descripción se fusionan en columna «documento»;
       header de 6→5 columnas."
```

### 4.2 — `epics.md` · UX-DR13 (table row)
```
OLD: Grid `150px minmax(160px,1fr) 44px 92px 116px 84px`
     (título / descripción / link / canal / autor / indexado), gap 12px, min-width 720px.
     … Columna título: … título (clamp 2) + badge "Nuevo" … Columna descripción: propia
     celda, 13px, --tx3, clamp 2 líneas. …
NEW: Grid `minmax(240px,1fr) 44px 92px 116px 84px`
     (documento / link / canal / autor / indexado), gap 12px, min-width 620px.
     … Columna documento: slot indicador 16px + título (clamp 2, siempre --tx, weight 700/500)
     + badge "Nuevo" (solo no leído) + descripción debajo (13px, --tx3, clamp 2) — misma celda. …
     + change-note: "Historia 8.2 — título/badge/descripción apilados en una única columna
       «documento»; grid de 6→5 tracks, min-width 720→620."
```

### 4.3 — `epics.md` · new Historia 8.2 (under Épico 8)
```
### Historia 8.2: web — DocsView: columna «Documento» unificada (título + descripción)

**Disparador:** el diseño actualizado fusiona título y descripción en una sola columna
«Documento» — título en la 1ª línea (badge "Nuevo" si no leído) + descripción debajo en texto
secundario, alineándose con las cards de Búsqueda (UX-DR11).

- AC1 · Layout 5 columnas: documento · link · canal · autor · indexado; grid
  `minmax(240px,1fr) 44px 92px 116px 84px`, min-width:620px, overflow-x:auto.
- AC2 · Celda «documento» apilada: indicador (dot/checkmark) + título (clamp-2, weight 700/500,
  siempre --tx) + badge "Nuevo" (solo no leído) + descripción (13px, --tx3, clamp-2) — misma celda.
- AC3 · Header 6→5 columnas: desaparece la cabecera «descripción»; «título» → «documento».
- AC4 · Sin regresión funcional/estados: acento de fila, checkmark/dot, botón-icono de link
  (bubbling → marca leído), filtros, "Sin leer", "Marcar todas", paginación, paridad de tema.
- AC5 · Tests verdes: DocsView.test.tsx y docs.spec.ts actualizados (grid 5-track, header
  «documento», descripción dentro de la celda de documento) y pasando.
```

### 4.4 — Implementation edits (executed by `bmad-dev-story`)
- **`packages/web/src/components/DocsView.tsx`**
  - Header: 6 spans → 5 (`document / link / channel / author / indexed`); grid → 5-track.
  - `DocRow`: grid → `minmax(240px,1fr) 44px 92px 116px 84px`, min-width 620; move the
    `doc-row-description` span **into** the title cell (after the "Nuevo" badge); remove the
    standalone description column.
- **`packages/web/src/components/DocsView.test.tsx`**
  - "6-column header" test → 5 columns + header label `documento`/`document`.
  - testid test (`doc-row-content` / `doc-row-description`) stays valid (both present, same cell).
- **`packages/web/tests/docs.spec.ts`**
  - grid regex `^150px …$` → `^\d+(\.\d+)?px 44px 92px 116px 84px$`; `getByText('título')` →
    `getByText('documento')`.
- **`packages/web/src/locales/{es,en}.json`**
  - `docs.columns.title` → `docs.columns.document` ("documento"/"document"); remove
    `docs.columns.description`.

### 4.5 — `sprint-status.yaml`
- `epic-8: done → in-progress`.
- Add story entry `8-2-web-docsview-columna-documento-unificada: backlog`.

---

## Section 5 — Implementation Handoff

- **Scope:** Moderate (reopens epic + new story + planning/code/test/i18n edits).
- **Now (on approval):** apply the planning-artifact edits — `epics.md` (UX-DR12, UX-DR13,
  Historia 8.2) and `sprint-status.yaml`.
- **Next:** `bmad-create-story 8-2` (full Gherkin ACs) → `bmad-dev-story` (web implementation on
  `feat/8-2-docsview-documento-column`) → `bmad-code-review` → `bmad-checkpoint-preview`.
- **Success criteria:** DocsView renders the single "Documento" column (title + "Nuevo" badge +
  description stacked); 5-column grid; light/dark parity; all filters/pagination/read-tracking
  unregressed; `DocsView.test.tsx` + `docs.spec.ts` green; verification gate
  (`lint && test && build`) green.
