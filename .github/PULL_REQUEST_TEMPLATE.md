<!-- Thanks for contributing! Keep the PR focused on one topic — it reviews faster. -->

## What & why

<!-- What does this PR do, and why? Link the issue it addresses. -->

Closes #

## Type of change

<!-- feat / fix / refactor / test / docs / chore / ci — and the scope: shared | bot | backend | workers | web | repo -->

## Verification gate

<!-- CI covers lint, typecheck, unit tests and build. Integration/e2e suites are
     NOT run by CI — run them locally when they apply and paste a summary. -->

- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run test` passes
- [ ] `npm run build` passes
- [ ] Touched DB/API: `npm run test:integration` passes locally (not run by CI)
- [ ] Touched UI: `npm run test:e2e` passes locally (screenshots below for visual changes)

## Invariants check (see CONTRIBUTING.md)

- [ ] No cross-service imports; contracts (Drizzle/Zod) only in `packages/shared`
- [ ] RBAC stays inside the vector query; workers stay idempotent
- [ ] No secrets in code, logs, or `Share2Brain.config.yml`

## Screenshots / notes for the reviewer

<!-- Optional: anything that makes reviewing easier. -->
