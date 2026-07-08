# Story OPS-2: Deterministic Backend Integration Tests (fix the recurring RBAC flake)

<!-- Post-roadmap operational-backlog story (P1.2). NOT part of a formal epic —
     Borja chose an explicit operational backlog over a hardening epic at the
     Epic 6 retrospective (2026-07-08). Numbered `ops-N` to stay outside the
     epic sequence. Source: operational-backlog.md#P1.2 -->

Status: ready-for-dev

## Story

As a developer relying on the integration gate,
I want `npm run test:integration` to pass deterministically,
so that a red run always means a real regression and never "the RBAC flake again."

---

## ⚠️ Reconciliation & investigation notes — read before implementing

1. **The symptom, on record (three times).** The 6.2, 6.3 and 6.4 Completion Notes all report the same non-deterministic failure in `packages/backend/src/rbac.integration.test.ts` / `channels.integration.test.ts`: an **extra `'test-guild'` role (or channel) appears in the RBAC response**, so an `expect(...).toEqual([...])` on `roles`/`allowedChannels` fails. It "passes on an isolated re-run." **None of those stories' diffs touched `packages/backend`** — it is pre-existing and environmental. First seen in the Epic 4 retro.

2. **Two documented root-cause vectors (confirm which — Task 1 is a reproduction spike).**
   - **(a) Shared global table + whole-table RBAC expansion.** `allowedChannels` is computed by intersecting the member's roles against the **entire** `channel_permissions` table (Story 4.2 note: "RBAC expansion resolves against the WHOLE channel_permissions table … a shared literal role … leaks into scope"). Any stray row — from a sibling test suite, a prior crashed run's un-cleaned fixture, or a live container — whose `allowed_roles` intersect the member's roles leaks a channel/role in. The `@everyone`-role injection (PR #32) adds the guild id as a role, so a shared `guild_id` literal (`'test-guild'`) can also surface.
   - **(b) Live dev containers on the same DB/Redis.** The 6.2/6.4 notes flag that `docker compose` `backend`/`bot` containers share the same Postgres+Redis the integration tests target, mutating `channel_permissions`/`users`/sessions mid-run. The `workers-integration` project is 100% green in isolation precisely because nothing else writes its rows.

3. **`rbac.integration.test.ts` already has partial defenses** — `itestChannels()` filters `allowedChannels` to the `itest-` prefix before asserting, and `afterAll` cleans `channel_permissions WHERE channel_id LIKE 'itest-%'` + its own `discord_id`. The gap: `res.body.roles` is asserted **unfiltered** (`toEqual(['admin','mod'])`), and any non-`itest-` channel row matching `admin`/`mod` can still change counts in `channels.integration.test.ts`. The isolation is prefix-scoped for channels but not for roles or for cross-suite writes.

4. **This is test-infra hardening, not a product change.** Do **not** change RBAC semantics (whole-table expansion is the AD-12 design — RBAC inside the query). The fix is deterministic fixtures + assertions + a clean-environment precondition. If Task 1 proves the leak is a genuine product correctness bug (not just a test-fixture collision), STOP and raise it with Borja before changing product code.

5. **Generalize the Epic 4 run-unique-isolation rule to `packages/backend`.** Epic 4 AI#3 established run-unique suffixes + own-id cleanup, and Story 6.3 applied a per-run salt (`String(Date.now()).slice(-8)`) to bot integration ids. The backend suites predate that discipline and use shared literals (`itest-admin`, `admin`, `MEMBER_DISCORD_ID`, `'test-guild'`). Bring them up to the same standard.

---

## Acceptance Criteria

### AC-1 — Reproduce and pin the leak (spike, gates the rest)

**Given** the recurring flake
**When** the developer runs the full `npm run test:integration` (all backend suites together) repeatedly, with and without live `docker compose backend`/`bot` containers attached to the same Postgres/Redis
**Then** the exact leak vector is identified and written up (which table/row, which suite or container introduces it, whether `res.body.roles` gains `'test-guild'` from the `@everyone` guild-id injection or from a stray `channel_permissions` row)
**And** the write-up states definitively whether the fix is test-only (fixtures) or whether a genuine product bug was found (→ escalate to Borja, do not fix product code silently)

### AC-2 — Run-unique fixtures across every backend integration suite

**Given** the backend integration suites seed `channel_permissions`, roles, `users`, channels
**When** they run
**Then** every seeded identifier (channel ids, role names, `discord_id`, guild id) is **run-unique** (a per-run salt, e.g. `itest-<salt>-admin`), so two suites — or two concurrent runs, or a leftover from a crashed run — cannot collide
**And** each suite's cleanup deletes only its own salted ids (no broad `LIKE 'itest-%'` that races sibling suites — the exact FK-abort hazard the current `rbac` `afterAll` comment already warns about)

### AC-3 — Assertions are scoped, not global

**Given** an RBAC/channels assertion on `roles` or `allowedChannels`
**When** it checks membership
**Then** it asserts against **this suite's salted** roles/channels only (extend the existing `itestChannels()` prefix-filter to `roles` too, or assert `toContain`/`not.toContain` on salted ids rather than `toEqual` on a full list)
**And** a stray unrelated row in a shared table can no longer flip the assertion

### AC-4 — Clean-environment precondition is enforced or documented

**Given** integration tests must not run against a stack with live dev containers writing the same tables
**When** the suite starts (or via the dev/CI runbook)
**Then** either the suite fails fast with a clear message if it detects competing writers (e.g. an unexpected non-salted row in a key table), **or** `docs/development_guide.md` documents "stop `docker compose` app containers (`backend`/`bot`/`workers`) before `npm run test:integration`, or run against a dedicated test DB" — and the guidance is discoverable (Task decides which; prefer fail-fast if cheap)

### AC-5 — Determinism proven

**Given** the fixes are in
**When** `npm run test:integration` (full backend project) runs **10× consecutively** on a clean DB
**Then** it is green every time, and green again with a stale leftover row deliberately inserted (proving assertions are now isolation-proof)

### AC-6 — Verification gate green

**Given** the implementation is complete
**When** the gate runs
**Then** `npm run lint` = 0, `npm run test` green, `npm run build` clean (5 packages), and `npm run test:integration` green and repeatable (AC-5). No production (`src` non-test) behavior changed unless AC-1 escalation was approved by Borja.

---

## Tasks / Subtasks

- [ ] **Task 1 — Reproduction spike (AC-1).** Run the full backend integration project in a loop (e.g. 10×) on a clean DB, then again with `docker compose up -d backend bot` attached. Capture which assertion fails, dump the offending `channel_permissions`/`users` rows and the `res.body.roles`/`allowedChannels` at failure. Determine: stray-row collision vs live-container write vs `@everyone` guild-id injection. Write findings into this story's Dev Notes. **Decision gate:** test-only fix → continue; product bug → HALT, raise with Borja.
- [ ] **Task 2 — Salt helper.** Add a shared test helper (co-located under `packages/backend/src/` test utils, or wherever `openTestClients`/`buildTestAppOptions` live) that produces a per-run salt and salted-id builders for channels, roles, `discord_id`, guild id — mirroring Story 6.3's `String(Date.now()).slice(-8)` approach and Epic 4 AI#3. Preserve any ordering/shape a suite depends on (e.g. snowflake-digit-length traps, if present).
- [ ] **Task 3 — Convert `rbac.integration.test.ts`.** Replace literal `itest-admin`/`admin`/`MEMBER_DISCORD_ID`/`'test-guild'` with salted ids; extend `itestChannels()`-style filtering to `roles`; scope `afterAll` deletes to salted ids only. Keep every existing behavioral assertion (per-request recompute, security boundary, non-intersecting roles).
- [ ] **Task 4 — Convert `channels.integration.test.ts`** (and audit `auth`, `documents`, `readStatus`, `search`, `conversations`, `chat`, `security`, and the `infrastructure/*.drizzle.integration.test.ts` suites) for the same shared-literal + broad-`LIKE`-cleanup hazards. Apply salted ids + scoped assertions/cleanup wherever a shared table is written. List which suites needed changes.
- [ ] **Task 5 — Clean-environment guard/doc (AC-4).** Prefer a cheap fail-fast precheck in `openTestClients` (or a `beforeAll` in a shared setup) that warns/fails if a competing writer is detected; otherwise document the precondition in `docs/development_guide.md`. Note the two-Redis-instances gotcha (Homebrew `localhost:6379` vs Compose) so the runbook names the right instance.
- [ ] **Task 6 — Prove determinism (AC-5).** Run the full backend integration project 10× on a clean DB (green each time), then with a deliberately-inserted stale row (still green). Paste evidence.
- [ ] **Task 7 — Verify gate (AC-6).** Run all four commands; paste real evidence in Completion Notes. Confirm the historically-flaky `rbac`/`channels` suites now pass in the full-suite run, not just in isolation.

---

## Dev Notes

### Architecture & patterns to follow
- **Test-infra only.** RBAC whole-table expansion is AD-12 (RBAC inside the query) — do not change it. The deliverable is deterministic tests, not new product behavior. The one exception is an AC-1-approved product-bug fix, gated by Borja.
- **Run-unique isolation is an established repo rule**, just not yet applied to the backend package: Epic 4 AI#3 ("run-unique test isolation as DoD: suffix-unique roles/channels per run + own-id cleanup; no broad LIKE cleanups that race sibling suites") and Story 6.3's salted bot integration ids. This story finishes generalizing it.
- **English only** in all code/comments/tests (project-context). Vitest, `*.integration.test.ts` under the `backend-integration` project.

### The leak, concretely (to confirm in Task 1)
- `allowedChannels` = every `channel_permissions` row whose `allowed_roles` intersect the member's effective roles (member's Discord roles + injected `@everyone` = guild id, PR #32). Whole-table scan → any stray matching row leaks.
- Current `rbac.integration.test.ts` defends channels via `itestChannels()` (prefix filter) but asserts `res.body.roles` with a bare `toEqual(['admin','mod'])`. A `'test-guild'` in `roles` therefore most likely comes from the **guild-id `@everyone` injection** when the app/config under test carries a `guild_id` of `'test-guild'` (or a session/config difference across suites) — Task 1 confirms.
- `afterAll` already documents the FK-abort hazard of broad `LIKE` deletes on `users`; extend that carefulness to `channel_permissions` (currently a broad `LIKE 'itest-%'`).

### Source tree — files to touch
- **UPDATE** `packages/backend/src/rbac.integration.test.ts`, `channels.integration.test.ts` (primary offenders)
- **AUDIT/UPDATE** the other `packages/backend/src/**/*.integration.test.ts` suites that write shared tables
- **NEW/UPDATE** a shared salt/test-util helper next to `openTestClients`/`buildTestAppOptions`
- **UPDATE** `docs/development_guide.md` (clean-environment precondition) and/or `openTestClients` (fail-fast precheck)
- **NO CHANGE** to production `src` (RBAC service/middleware/schema) — unless AC-1 escalation approved

### Testing standards
- The whole point is determinism: AC-5's 10×-clean + stale-row runs are the real acceptance test. Salted ids + scoped assertions + own-id cleanup. Do not weaken a real assertion to make it pass — if a real product bug is found, escalate (AC-1). Every changed test must still fail on a genuine regression (Epic 5 "a test that lies" rule).

### Previous-story intelligence
- **Story 4.2 / Epic 4 retro** — origin of the whole-table-expansion leak observation and the run-unique-isolation DoD rule (AI#3).
- **Story 6.3** — per-run salt (`String(Date.now()).slice(-8)`) for bot integration ids + the FK-cleanup-race lesson; reuse the approach.
- **Stories 6.2 / 6.4 Completion Notes** — document this exact flake as pre-existing/unrelated; use them as the reproduction starting point.
- **Redis gotcha (memory):** two Redis instances (Homebrew `localhost:6379` vs Compose no-ports) — the clean-environment runbook must name the right one.

### References
- [Source: operational-backlog.md#P1.2]
- [Source: epic-6-retro-2026-07-08.md#5 — Action Item 3]
- [Source: packages/backend/src/rbac.integration.test.ts — current fixtures + afterAll]
- [Source: packages/backend/src/channels.integration.test.ts — second offender]
- [Source: Story 4-2 completion notes — whole-table RBAC expansion leak]
- [Source: packages/bot/src/sync/offlineSync.integration.test.ts — Story 6.3 salted-id pattern to copy]

## Project Context Reference

See `_bmad-output/project-context.md` (RBAC/AD-12, integration-test conventions, never-log-content) and `CLAUDE.md`. Standards: `docs/base-standards.md`, `docs/backend-standards.md`, `docs/development_guide.md`.

## Decisions (to confirm with Borja before/at implementation)

- **D1 — fail-fast guard vs runbook doc (AC-4).** Recommend a cheap `beforeAll` precheck that fails with a clear message when a competing writer is detected, *plus* a one-line note in `development_guide.md`. Confirm you want the guard (vs doc-only).
- **D2 — scope of the audit (Task 4).** Recommend converting `rbac` + `channels` (the known offenders) fully now, and auditing the rest but only converting suites that actually write shared tables, to keep the diff focused. Confirm vs "convert all backend integration suites for consistency."
- **D3 — if Task 1 finds a real product bug** (whole-table expansion leaking across guilds/tenants in production, not just tests): HALT and raise it — it would become its own story, not a test fix.

## Dev Agent Record

### Agent Model Used

_(to be filled by bmad-dev-story)_

### Debug Log References

_(to be filled)_

### Completion Notes List

_(to be filled)_

### File List

_(to be filled)_

## Change Log

- 2026-07-08 — Story OPS-2 created (bmad-create-story) from operational-backlog P1.2, picked up alongside OPS-1 after the Epic 6 retro. Fixes the recurring `rbac`/`channels` integration flake ("test-guild role leak") reported as pre-existing in the 6.2/6.3/6.4 Completion Notes and first seen in Epic 4. Test-infra hardening (run-unique salted fixtures + scoped assertions + clean-environment precondition), generalizing the Epic 4 run-unique-isolation rule to `packages/backend`; no product change unless a reproduction spike (Task 1) proves a real bug (→ escalate to Borja). Numbered `ops-N`, outside the epic sequence. Status → ready-for-dev.
