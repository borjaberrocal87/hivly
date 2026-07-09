---
baseline_commit: 395dc0a3b3b130b5ca13d8216f3e5424e0632715
---

# Story 7.2: workers/indexer — extracción de URLs, UrlFetcher (SSRF) y generación IA

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
<!-- Ultimate context engine analysis completed 2026-07-09 — comprehensive developer guide created
     (3 parallel deep-dives: workers current-state, docs/contracts blast radius, SSRF/fetch/LLM
     tech research empirically verified). -->

## Story

As a **community operator pivoting Hivly into an AI-curated resource index**,
I want **the Indexer worker to index ONLY messages containing URLs — fetching each URL behind a
real SSRF guard and generating an AI `title`+`description` per resource in `enrichment.language`**,
so that **the knowledge base becomes the curated resource index ratified by the Epic 7 pivot
(FR5): one enriched, citable row per URL, with non-link chatter discarded**.

**Source**: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-07-09.md` (approved
correct-course, scope **Major**), FR5 rewritten in `epics.md:24`. Epic 7 Story 2 of 6.
This story is the **behavioral core** of the pivot: it demolishes grouping/chunking in the
Indexer and replaces it with extract → fetch (SSRF-guarded) → enrich (LLM) → embed → persist.

**Depends on**: Story 7.1 (**done, merged** — PR #45, main @ `395dc0a`). The schema
(`embeddings.title/description/link`), the required `enrichment` config block, and the widened
`createChatModel(ChatModelConfig)` are all already on main.

**Out of scope** (do NOT implement): sync/processUpdate link-diff re-index (Story 7.3 — its
placeholder writes stay as-is), backend projection/prompt/citations (7.4), web UI (7.5), e2e
harness extension (7.6), and **FR21 notifications** — the 6.4 Notifier is deliberately
crash-alerts-only; the knowledge-lifecycle notifier ("recurso enriquecido indexado") remains
deferred. `indexBatch` must NOT emit notifications.

## Decisions confirmed with Borja (2026-07-09, story creation)

| # | Fork | Decision |
|---|---|---|
| D1 | LLM enrichment hard failure (provider down, persistent 429, invalid output after retry) | **No-ACK → PEL replay**, exactly like embedder failures today. The curated index never receives non-AI rows; transient outages self-heal via redelivery/boot replay. Accepted cost: a poison entry replays on every boot (no retry-cap by design — AD-13 / P2.2 stays deferred). Fetch failure is NOT a processing failure (ratified fallback); only LLM/embed/DB errors leave the entry un-ACKed. |
| D2 | SSRF-blocked URL (disallowed scheme, private/link-local/metadata IP, rebinding) | **Skip that URL entirely — no row.** A link the fetcher refuses for security must not become a citable resource (it would surface private/internal URLs as clickable citations). If ALL URLs of a message are blocked, the message is discarded like a no-URL message. Blocked ≠ failure: the entry is still ACKed. |
| D3 | New dependency | **`undici` added as an explicit dependency of `@hivly/workers`** — the story's ONLY new dep. Needed for `Agent({ connect: { lookup } })` (SSRF Layer B: validates the IP the socket actually connects to → defeats DNS rebinding; Node's bundled undici doesn't export `Agent`). Also pins ≥ 7.18.0 (CVE-2026-22036 unbounded-decompression fix) independently of the base image. |
| D4 | `knowledge` config block + chunking fate | **Retire in 7.3.** `sync/processUpdate.ts` still consumes `chunkContents` + `knowledge.chunk_size` until 7.3 rewrites it. 7.2 deletes only the indexer-exclusive grouping (`groupByChannel`, `MAX_GROUPING_WINDOW`, the `MessageGroup` type, main.ts grouping clamp warning) and stops the Indexer using chunking. `chunking.ts`, `@langchain/textsplitters`, the `knowledge` config block, and the main.ts chunk-size clamp warning survive untouched. |

### Design decisions embedded in the ACs (recommended defaults — veto at review)

- **Discard stamps `indexed_at`**: a no-URL (or all-blocked) message gets `indexed_at = now()`
  + XACK. `indexed_at` now means "evaluated by the Indexer", not "has embeddings" — this keeps
  `partitionByIndexState` dedup semantics working (redelivery hits the already-indexed ACK path).
- **Same URL twice in one message → ONE row**: dedup by normalized `URL.href` during extraction,
  preserving first-occurrence order.
- **`urlIndex` = position in the extracted, normalized, deduped, scheme-valid list** (0-based).
  URLs blocked later at fetch time (D2) simply produce no row — gaps in the `chunk_key` sequence
  are fine and deterministic (`chunk_key` is a dedup key, not a counter).
- **Embedding input**: `` `${title}\n\n${description}` `` — define it once as a helper so 7.3/7.4
  reuse the exact same concatenation.
- **AbortSignal threaded end-to-end**: shutdown signal → `runIndexer` → `indexBatch` → every
  fetch and LLM call; abort checked between URLs. An aborted batch leaves entries un-ACKed —
  safe by AD-13 (replay).
- **`Accept-Encoding: identity`** on outbound fetches (decompression-amplification defense,
  CVE-2026-22036) with the streaming byte cap as the backstop.
- **LLM input truncation caps are module constants** (not config) — the proposal ratified no
  such knob; avoid config churn.

## Acceptance Criteria

1. **URL extraction module** — `packages/workers/src/enrichment/extractUrls.ts` (**tests-first**):
   - `extractUrls(content: string, allowedSchemes: ('http'|'https')[]): string[]` — ordered,
     deduped, normalized; **deterministic and order-stable** over identical input (AD-13:
     `chunk_key` derives from it).
   - Handles: bare URLs; Discord suppressed-embed angle brackets `<https://…>`; markdown links
     `[text](https://…)`; trailing punctuation stripping (iteratively strip a trailing run of
     `.,;:!?'")]>`, keeping a trailing `)` only while the URL contains an unmatched `(`, e.g.
     Wikipedia disambiguation); uppercase schemes (normalize via the `URL` object, never
     compare raw strings).
   - Candidate regex baseline: `/\bhttps?:\/\/[^\s<>]+/gi` applied after unwrapping
     angle-bracket and markdown forms — parens MUST be allowed inside the match (the
     trailing-punctuation pass above owns the paren-balance decision; a class that excludes
     `()` would truncate `…/Foo_(bar)` before that pass ever runs).
   - Validate candidates with `URL.canParse` → `new URL()`; drop candidates whose protocol is
     not in `allowedSchemes` (from `config.enrichment.fetch.allowed_schemes`); drop URLs with
     embedded credentials (`url.username || url.password`).
   - Store/return the **normalized `url.href`** (lowercased scheme/host, resolved default port,
     percent-normalized) — this is what gets persisted as `link` and what dedup keys on.
2. **SSRF guard** — `packages/workers/src/enrichment/ssrfGuard.ts` (**tests-first**):
   - Shape: a factory — `createGuardedDispatcher(fetchConfig, blockList?)` (plus the Layer A
     check function). The static range set below is a module constant; the injectable
     `blockList` parameter exists for tests (AC-8's redirect re-check case); **`main.ts` builds
     the dispatcher once at boot and injects it** (consistent with AC-6 — no module-level
     singleton `Agent`).
   - `node:net` `BlockList` with the full range set: IPv4
     `0.0.0.0/8, 10.0.0.0/8, 100.64.0.0/10 (CGNAT), 127.0.0.0/8, 169.254.0.0/16 (link-local +
     cloud metadata), 172.16.0.0/12, 192.0.0.0/24, 192.0.2.0/24, 192.168.0.0/16, 198.18.0.0/15,
     198.51.100.0/24, 203.0.113.0/24, 224.0.0.0/4, 240.0.0.0/4`; IPv6 `::1, ::, fc00::/7 (ULA),
     fe80::/10, ff00::/8, 2001:db8::/32, 64:ff9b::/96 (NAT64)`. IPv4-mapped IPv6 (`::ffff:…`)
     is matched against the v4 rules by `BlockList` automatically — cover with a test.
   - **Layer A (pre-check, per redirect hop)**: parse the URL; if the hostname is an IP literal
     (`net.isIP` after stripping IPv6 brackets) → `BlockList.check` directly and reject when
     blocked. This is MANDATORY: undici's `connect.lookup` is **not invoked for IP-literal
     hosts** (empirically verified) — Layer B alone is bypassable with `http://127.0.0.1/`,
     and `new URL()` already normalizes decimal/hex/octal encodings (`http://2130706433/` →
     `127.0.0.1`) so the literal check catches those too.
   - **Layer B (connect-time)**: a module-level undici `Agent({ connect: { lookup } })` whose
     lookup resolves with `dns.lookup(hostname, { all: true, verbatim: true })` and rejects if
     ANY resolved address is blocked; otherwise passes the address list through — undici
     connects to exactly those validated IPs (defeats DNS rebinding / TOCTOU).
   - Both layers are active only when `config.enrichment.fetch.block_private_ips === true`;
     when `false`, fetches go through the default dispatcher (documented as dev-only escape
     hatch — the shipped default is `true`).
3. **UrlFetcher** — `packages/workers/src/enrichment/urlFetcher.ts` (**tests-first**):
   - `fetchUrl(url: string, fetchConfig: EnrichmentConfig['fetch'], signal: AbortSignal):
     Promise<FetchOutcome>` with a typed outcome union — it **never throws**:
     `{ ok: true, body: string, contentType: string, finalUrl: string }` |
     `{ ok: false, reason: 'ssrf_blocked' | 'scheme_disallowed' | 'too_many_redirects' |
     'timeout' | 'too_large' | 'http_error' | 'network_error' }`.
   - **Manual redirect loop**: `fetch(url, { dispatcher, redirect: 'manual', signal })`; on
     3xx with `Location`: resolve relative locations against the current URL, cancel the
     redirect body, re-run Layer A + the scheme allowlist on the NEW hop (a public host
     301→`http://169.254.169.254/` is the classic bypass), count hops, fail with
     `too_many_redirects` past `max_redirects`. undici's `redirect: 'manual'` returns the real
     3xx with readable `location` (verified — not an opaque response).
   - **Timeout**: `AbortSignal.any([AbortSignal.timeout(fetchConfig.timeout_ms), signal])` per
     hop. **Size cap**: `Content-Length` used only as a cheap early reject (header can be
     absent or lying); real enforcement is a streaming reader that cancels past `max_bytes`
     **decoded** bytes. Send `Accept-Encoding: identity` and `User-Agent: fetchConfig.user_agent`.
   - Final non-2xx status → `http_error`. DNS/socket/TLS errors → `network_error`;
     Layer A/B rejections → `ssrf_blocked`.
   - **Logging discipline**: never log fetched bodies; log the URL, outcome reason, and byte
     count only (shared logger convention).
4. **HTML→text hints** — `packages/workers/src/enrichment/htmlText.ts` (zero-dep, tests-first):
   - From an HTML body extract: `<title>`, `meta[name=description]`, `og:title`,
     `og:description` (highest-signal hints), plus body text with `<script>`/`<style>` blocks
     removed, remaining tags stripped, common entities decoded, whitespace collapsed, truncated
     to a module-constant cap (~8,000 chars).
   - Non-HTML `text/*` content: use the truncated raw text. Any other content type (PDF, image,
     binary): treat as unusable content → the enrichment falls back to message-text-only, per
     the ratified "no extractors in v1" decision. No cheerio/jsdom/html-to-text — regex-tier is
     sufficient for title/description generation.
5. **AI enrichment module** — `packages/workers/src/enrichment/enrich.ts` (**tests-first**):
   - The chat model is built ONCE in `main.ts` via `createChatModel(config.enrichment.llm)`
     (`@hivly/shared/providers` — reuse, AD-2-safe) and injected into the pipeline behind a
     **narrow structural interface** (mirror the `Embedder` pattern in `types.ts:18-20`) so
     unit tests inject fakes — never mock `BaseChatModel` itself.
   - Primary path: `.withStructuredOutput(EnrichmentOutputSchema)` where the schema is
     `z.object({ title: z.string(), description: z.string() })`; **re-parse the result with the
     Zod schema** (zod-4 inference through LangChain can degrade to `Record<string, any>`).
     Fallback trigger is **runtime, not config-sniffed**: if the structured-output attempt
     throws OR its result fails the Zod parse, make ONE fallback attempt — plain `invoke` with
     an explicit "return ONLY minified JSON" instruction + fence-strip + `JSON.parse` + Zod
     parse; if that also fails, it is a D1 enrichment failure. (This serves custom
     OpenAI-compatible providers without tool calling AND custom providers that do support it,
     without branching on `provider`.) Both paths normalize output: trim, collapse whitespace;
     **empty title OR description after trim = enrichment failure** (D1 — no silent junk rows).
   - Prompt inputs: the Discord message text + (when fetch succeeded) the title/meta/OG hints
     and truncated page text; when fetch failed, message text only — the prompt must say the
     page content was unavailable. The prompt MUST instruct output in
     `config.enrichment.language`. Input truncation before invoking (module constants).
   - The prompt and all code/comments are English; `enrichment.language` only controls the
     GENERATED title/description language.
6. **`indexBatch` rewritten as the resource pipeline** (FR5) — `packages/workers/src/indexer/indexBatch.ts` (**tests-first**):
   - **Kept verbatim from today**: `parseCreatedEvent` step incl. malformed/tombstone → warn +
     ACK; the single dedup-state SELECT + `partitionByIndexState` (`ackNow` / `pending`
     row-missing / `toProcess`); the in-batch producer-duplicate dedup with
     `extraStreamIdsByMessageId`; per-message error isolation (one failure never blocks other
     messages, `indexBatch` never throws for data failures); the `assertEmbeddingDimensions`
     guard with no-ACK on mismatch; the vector-count-vs-input check; ACK gated on the
     `UPDATE … RETURNING` stamped-ids set. `partitionByIndexState` survives — relocate it out
     of `grouping.ts` (e.g. `indexer/partition.ts`) since the rest of that file dies.
   - **New per-message flow** (replaces group/chunk/embed steps): extract URLs from
     `event.content` (AC-1). **Zero URLs → discard**: stamp `indexed_at = now()` + ACK — no
     embedding row (D2's all-blocked case converges here too); the discard stamp uses the SAME
     `UPDATE … RETURNING`-gated ACK as the persist path (no ACK if the row vanished between
     the dedup SELECT and the stamp). Otherwise, per URL in order
     (index = position per the design decision): `fetchUrl` (AC-3) → outcome `ok` → enrich with
     page content; `ssrf_blocked`/`scheme_disallowed` → **skip the URL, no row** (D2); any
     other failure reason → **enrich with message-text-only fallback** (resource still
     indexed, ratified). Enrichment or embedding hard failure for ANY url of the message →
     the whole message is a processing failure: nothing stamped, entry left un-ACKed (D1);
     rows already persisted for that message in a previous attempt converge via UPSERT on
     redelivery.
   - Embed all of a message's `${title}\n\n${description}` texts with ONE
     `embedder.embedDocuments` call; then persist **all rows of the message + the
     `indexed_at` stamp in ONE transaction** (successor of `persistGroup`):
     `chunkKey: \`${messageId}:${urlIndex}\``, `title`, `description`, `link` (normalized
     href), `embedding`, `channelId`, `messageIds: [messageId]`, with the existing
     `onConflictDoUpdate` on `embeddings.chunkKey` (same `excluded.*` set list as today).
     **All fetch/LLM/embed I/O happens OUTSIDE the transaction** — never hold a pooled
     connection across external calls (established rule, `processUpdate.ts:67-70`).
   - **AbortSignal threaded**: `runIndexer`'s signal reaches `indexBatch` and every
     fetch/LLM call; check `signal.aborted` between URLs and bail out of the batch leaving
     remaining entries un-ACKed (shutdown drain is 7s in-process / 35s compose — a multi-URL
     message cannot be assumed to finish; PEL replay is the safety net, document this in the
     Dev Agent Record).
   - **Demolition** (D4 boundary): delete `groupByChannel` + `MAX_GROUPING_WINDOW` (and
     `grouping.ts` itself once `partitionByIndexState` moves), the `MessageGroup` type in
     `types.ts`, the `chunkContents` import in `indexBatch.ts`, and the grouping clamp
     warning in `main.ts:91-96` (KEEP the chunk-size clamp at `:97-102` — sync still chunks
     until 7.3; reword the shared comment block at `:88-90` accordingly). `chunking.ts` + its
     test + `@langchain/textsplitters` + the `knowledge` config block are NOT touched.
   - `main.ts` wiring: build the enrichment chat model + the guarded dispatcher once at boot
     (after `loadConfig`, before `runIndexer`), inject as deps like the embedder.
     `consumer.ts` loop mechanics (COUNT/BLOCK/PEL replay/ack discipline) unchanged.
7. **Shared `link` refine hardened** (sanctioned by the 7.1 review deferral — `feat(shared)` slice):
   - Replace the prefix-regex refine on `link` in `SearchFragmentSchema`, `DocumentFragmentSchema`,
     and `CitationSchema` with a parse-based check:
     `v === '' || (URL.canParse(v) && ['http:', 'https:'].includes(new URL(v).protocol))` —
     case-insensitive by construction, rejects host-less `https://`, embedded whitespace, and
     trailing garbage. Keep `''` valid (backend seeds/legacy placeholders; 7.4 updates the seed).
     Do NOT introduce `z.string().url()` (deprecated) or strict `z.url()` (breaks `''`).
     `config` `base_url` refines stay as-is (different convention, out of scope).
   - Add reject-case tests (whitespace inside, `https://` without host, `ftp://x`) and an
     accept case for an uppercase-scheme URL. Existing `link: ''` fixtures across
     backend/web/e2e must stay green (they do — `''` remains valid).
   - This closes the recorded hazard: `ragRetriever.drizzle.ts` parses per-row with no
     try/catch, so 7.2 must only ever persist links that pass this refine — guaranteed by
     storing `URL.href` (AC-1).
8. **Unit tests** (Vitest, co-located, AAA, `should X when Y`; fakes only — no real network
   beyond ephemeral `127.0.0.1` servers, never a real LLM/embeddings call):
   - `extractUrls.test.ts`: bare/angle-bracket/markdown forms, trailing punctuation, balanced
     parens, uppercase scheme, credentials rejection, scheme filter, dedup order-stability,
     no-URL → `[]`, determinism (same input twice → identical output).
   - `ssrfGuard.test.ts`: representative blocked ranges (127.0.0.1, 10.x, 169.254.169.254,
     `::1`, `fc00::1`, `::ffff:169.254.169.254`), decimal/hex/octal literals via URL
     normalization, public IP passes, `block_private_ips: false` bypass.
   - `urlFetcher.test.ts`: drive against an ephemeral `node:http` server on `127.0.0.1` with
     `block_private_ips: false` for mechanics — 2xx body, redirect chain followed with cap,
     `Content-Length` early reject, streaming over-cap abort → `too_large`, slow response →
     `timeout`, non-2xx → `http_error`, connection refused → `network_error`. **Redirect
     re-check case (must exercise the per-hop revalidation, not the first-hop literal
     check)**: inject a custom BlockList (AC-2 factory param) that blocks `169.254.0.0/16`
     but NOT `127.0.0.1`, have the local server respond `301 → http://169.254.169.254/`, and
     assert `ssrf_blocked` — with the default blocklist this test would false-pass on the
     first hop (`127.0.0.1` is itself blocked) without ever reaching the redirect logic.
     Keep a separate direct-IP-literal test using the default blocklist.
   - `htmlText.test.ts`: title/meta/OG extraction, script/style removal, entity decode,
     truncation, non-HTML passthrough.
   - `enrich.test.ts`: structured-output success (fake model), JSON-fallback success, one
     retry then failure, empty-title/description → failure, prompt carries
     `enrichment.language` and the fetch-failed variant.
   - `indexBatch.test.ts` **rewrite** (reuse the existing `makeFakeDb` + deterministic-fake
     patterns): no-URL discard (stamp + ACK, zero inserts), multi-URL message → rows `m1:0`
     and `m1:1` with `messageIds: ['m1']`, duplicate URL → one row, fetch-failure → text-only
     row still persisted with `link`, SSRF-blocked URL skipped (gap in indexes, other rows
     persist), all-blocked → discard, LLM failure → no stamp + un-ACKed, embed dimension
     mismatch → un-ACKed, producer-dup dedup, RETURNING-gated ACK, tombstone/malformed ACK,
     redelivery convergence (UPSERT same chunk_key). `events.test.ts` stays untouched;
     `consumer.test.ts` keeps its cases (loop mechanics are unchanged) but its typed dep
     literals gain the new injected fakes — `RunIndexerDeps`/`IndexBatchDeps` DO grow (model +
     dispatcher + signal threading per AC-6); do NOT construct the model/dispatcher inside
     `consumer.ts`/`indexBatch.ts` to dodge that. Move `partitionByIndexState` tests alongside
     the relocated function; `grouping.test.ts` disappears with `grouping.ts`.
9. **Integration tests** — `indexBatch.integration.test.ts` **rewrite** (real Postgres+Redis;
   fake embedder, fake enricher, fetcher stubbed or pointed at an ephemeral local server —
   NEVER real network/LLM):
   - Reuse the established skeleton: `openTestClients()`, run-unique salt (`itest-7-2-…`),
     fresh per-test consumer group at `'$'`, afterAll cleanup by salted ids
     (`chunk_key like '<id>:%'`).
   - Cases: URL message → row with real `title/description/link` + `indexed_at` stamped + PEL
     drained; no-URL message → zero rows, `indexed_at` stamped, ACKed; redelivery → single
     converged row per chunk_key; enrichment failure → entry stays in PEL, `indexed_at` NULL.
   - Mandatory-steps §3.2 idempotency check is covered by the redelivery case; paste evidence.
   - **Env-gated real-LLM smoke** (standing DoD for any new LLM path): a smoke test or script
     gated by an env var (e.g. `ENRICHMENT_SMOKE=1`) that runs `enrich` once against the real
     configured provider and asserts non-empty title/description in `enrichment.language`.
     Not part of CI; run it once locally and paste the evidence.
10. **Docs synchronized** (mandatory-steps §3.5 — this story owns the ingestion rewrite, 7.1 D4):
    - `docs/context/TECHNICAL-DESIGN.md`: **§7 rewritten** (remove the "Superseded" banner;
      new mermaid: XREADGROUP → extract URLs → discard-if-none → per URL: SSRF-guarded fetch →
      LLM enrich (fallback text-only) → embed `title+description` → INSERT per URL → stamp →
      XACK); **§5.3** workers pseudocode updated to the new pipeline; **§17** "Batching del
      Indexer" row marked superseded/removed.
    - `docs/context/ARCHITECTURE-SPINE.md`: AD-13 ingestion-capability note flipped from
      future to present tense ("realiza", not "va a realizar"); the Deferred § "Estrategia de
      batching del Indexer" (Story 3.3 design) marked superseded by Epic 7.
    - `docs/data-model.md`: "(Story 7.2)" future-tense field notes updated to present.
    - `packages/shared/src/db/schema.ts` comments: only if wording still says "Story 7.2 will".
    - `docs/context/PRD.md`: the ingestion-flow description this story replaces (incremental,
      per the pivot note's own instruction).
    - `_bmad-output/implementation-artifacts/operational-backlog.md`: add an entry homing the
      **FR21 knowledge-lifecycle notification deferral** ("recurso enriquecido indexado") —
      Épico 7 lists FR21 as covered but no 7.x story implements it and the 6.4 Notifier is
      crash-alerts-only by design; record the debt explicitly (Epic 6 retro convention).
    - `epics.md` needs NO edit (FR5 already rewritten by 7.1).
11. **Verification gate green and pasted as evidence** (agent-run): `npm run lint` &&
    `npm run test` (unit+web) && `npm run build`; `npm run test:integration` (backend + bot +
    workers against real Postgres/Redis — **stop compose app containers first**; `docker
    compose stop bot backend workers`); `npm run test:e2e -w @hivly/web` (13 specs must stay
    green — the backend e2e seed still writes placeholder rows until 7.4; specs assert
    testids/classes, not content). New dep `undici` appears ONLY in
    `packages/workers/package.json`.

## Tasks / Subtasks

- [x] Task 0 — Branch + preconditions (AC: all)
  - [x] `git branch --show-current` → if `main`, `git switch -c feat/7-2-indexer-url-enrichment`.
  - [x] `docker compose up -d postgres redis`; stop app containers (bot/backend/workers) if running.
  - [x] `npm install undici -w @hivly/workers` (latest 7.x/8.x, must be ≥ 7.18.0 — D3). Verify
        local `.env` has `ENRICHMENT_LLM_API_KEY` and `Hivly.config.yml` has the `enrichment` block
        (both landed in 7.1; local dev may reuse `LLM_API_KEY`'s value).
- [x] Task 1 — Shared `link` refine hardening (AC: 7) — `feat(shared)` slice
  - [x] Write the reject/accept cases red in `search.test.ts`/`documents.test.ts`/`citation.test.ts`,
        then swap the refine (one shared helper, e.g. in a small `schemas/linkRefine.ts`).
  - [x] Run backend/web unit suites to confirm `link: ''` fixtures stay green.
- [x] Task 2 — `extractUrls` (AC: 1) — tests-first red → green.
- [x] Task 3 — SSRF guard + UrlFetcher + htmlText (AC: 2, 3, 4) — tests-first
  - [x] `ssrfGuard.ts`: BlockList + Layer A check + guarded `Agent` factory.
  - [x] `urlFetcher.ts`: manual-redirect loop, timeout, streaming cap, typed outcomes.
  - [x] `htmlText.ts`: hints + stripped/truncated text.
  - [x] Ephemeral local-server unit harness for fetch mechanics.
- [x] Task 4 — `enrich` module (AC: 5) — tests-first; structural model interface; both output paths.
- [x] Task 5 — `indexBatch` rewrite + demolition + wiring (AC: 6) — tests-first
  - [x] Rewrite `indexBatch.test.ts` red (full case list in AC-8), then implement.
  - [x] Relocate `partitionByIndexState` (+ its tests); delete `grouping.ts`/`grouping.test.ts`
        grouping parts, `MessageGroup`, main.ts grouping clamp; leave chunking/knowledge alone (D4).
  - [x] `main.ts`: build chat model + dispatcher, inject; thread AbortSignal into the pipeline.
- [x] Task 6 — Integration tests rewrite (AC: 9) + env-gated real-LLM smoke run (paste evidence).
- [x] Task 7 — Docs sync (AC: 10) per bullet list.
- [x] Task 8 — Verification gate + evidence (AC: 11); update Dev Agent Record; flip sprint-status
      `7-2-…` → `review`; commit in slices (§Git intelligence) and open the PR.

## Dev Notes

### Architecture compliance (invariants that bind this story)

- **AD-13 (the heart of this story)**: XACK **only** after committed persistence (or when an
  entry can never succeed — malformed/tombstone/discard). The PEL is the implicit DLQ; there is
  no retry cap (P2.2 deliberately deferred) — that is WHY D1/D2 classify outcomes carefully:
  fetch failure and SSRF block are *successful processing* (ACK), only LLM/embed/DB errors are
  *failures* (no ACK). Idempotency mechanism: deterministic `chunk_key` + UPSERT convergence —
  redelivery re-runs fetch+LLM and may produce DIFFERENT AI text; last-write-wins per chunk_key
  is the ratified convergence model (spine AD-13 note).
- **AD-2**: no cross-service imports. The enrichment LLM comes from `@hivly/shared/providers`
  (`createChatModel` already accepts `config.enrichment.llm` — widened in 7.1). `providers/` is
  subpath-only; never re-export from the shared root barrel.
- **AD-8**: `loadConfig()` in `main.ts` aborts on invalid YAML pre-I/O. The `enrichment` block
  is REQUIRED — no defensive defaults in code; trust the parsed config.
- **AD-5/AD-6**: NO schema/migration work in this story (7.1 did it). The only shared touch is
  the `link` refine hardening (AC-7), a sanctioned contract tightening.
- **AD-12**: untouched — do not modify any RBAC SQL. `channelId` keeps flowing into every row.
- **NFR/risk register**: SSRF is the proposal's red risk — "real work, not a flag"
  (§2.3 Risk 1); cost/latency is orange (one fetch + one LLM call per URL — log enough to
  observe it: per-message URL count, outcome reasons, durations at debug level).

### Current state — verbatim anchors (verified 2026-07-09, main @ 395dc0a)

**`indexBatch.ts` (219 lines) today**: parse (`:48-62`, malformed/tombstone → warn + ACK) →
one dedup SELECT over distinct messageIds (`:64-69`) → `partitionByIndexState` (`:71`) →
in-batch producer-dup dedup with `extraStreamIdsByMessageId` (`:81-101`, up-to-3x COMMIT-race
amplification documented) → per group: `stage` tracking (`'chunk'|'embed'|'persist'`, `:115`),
`groupByChannel(…, config.knowledge.grouping_window)` (`:104`), `chunkContents` (`:117`),
`embedder.embedDocuments` (`:121`), vector-count check (`:126-130`),
`assertEmbeddingDimensions` per vector → `continue` no-ACK on mismatch (`:134-143`),
`persistGroup` (`:146`) → ACK gated on RETURNING set + duplicate extras (`:150-155`), per-group
catch-all keeps later groups running (`:156-163`). **`indexBatch` never throws for data
failures.** `persistGroup` (`:174-219`): one transaction — per chunk
`insert(embeddings).values({ chunkKey: \`${group.messageIds[0]}:${i}\`, title: '',
description: chunks[i], link: '', … }).onConflictDoUpdate({ target: embeddings.chunkKey,
set: { title: sql\`excluded.title\`, … } })`, then `update(discordMessages).set({ indexedAt:
sql\`now()\` }).where(inArray(…)).returning({ id })`. Imports from `@hivly/shared/db`:
`discordMessages, embeddings, inArray, sql`.

**Keep-list vs demolition inside the file**: parse step, dedup SELECT, partition, producer-dup
dedup, dimension/count guards, RETURNING-gated ACK, per-message isolation, transaction shape →
**keep** (adapted per message instead of per group). `groupByChannel`, `chunkContents`,
chunk-index chunk_keys, multi-message `messageIds` → **demolish**.

**`consumer.ts` (unchanged by 7.2)**: `CONSUMER='consumer-1'`, `COUNT=10`, `BLOCK_MS=5000`
hardcoded (`:17-19`); stream/group from `STREAM_KEYS.DISCORD_MESSAGES` /
`CONSUMER_GROUPS.INDEXER` (never hardcode); idempotent `xGroupCreate(…, '0', {MKSTREAM})` with
BUSYGROUP tolerance (`:42-48`); boot PEL replay from `'0'` advancing `replayId` past each batch
acked-or-not (`:53-64`); live `xReadGroup('>')` loop with `signal.aborted` checks (`:68-80`).
Strictly sequential on a dedicated Redis client.

**`grouping.ts`**: `partitionByIndexState` (`:18`) — **NOT grouping; it survives** (relocate);
`MAX_GROUPING_WINDOW = 50` (`:55`) and `groupByChannel` (`:57`) die. Importers:
`indexBatch.ts:16-18`, `main.ts:17-18` (clamp warnings `:91-102` — grouping one dies, chunk one
stays per D4), tests.

**`chunking.ts`**: exports `ChunkOptions`/`MAX_CHUNK_SIZE=8000`/`chunkContents`; still imported
by `sync/processUpdate.ts:15` → **must survive until 7.3** (D4). `@langchain/textsplitters` in
workers `package.json:14` stays.

**`types.ts`**: `Embedder` (`:18-20`, `embedDocuments(texts: string[]): Promise<number[][]>`) —
the injection pattern to copy for the enrichment model; `MessageGroup` (`:49-57`) dies;
`PartitionResult`/`IndexStateRow`/`ParsedEntry`/`RawStreamEntry` survive.

**`events.ts` `parseCreatedEvent` (`:18-42`)**: gates on `type === 'discord.message.created'`
and non-blank `messageId`/`channelId`/`content` (blank content → `null` → ACKed already);
content passes through un-trimmed — with chunking gone, the URL extractor is the new owner of
whitespace handling. Parser unchanged by 7.2; the no-URL discard decision lives AFTER parsing.

**`main.ts` (273 lines)**: boot order `loadConfig` → `createLogger` → `createNotifier` → clamp
warnings (`:91-102`) → crash handlers (`:110-124`) → SIGTERM/SIGINT registered before boot work
(`:126-189`, 7s in-process drain race + bounded redis/db teardown, `stop_grace_period: 35s` in
compose) → `requireEnv` → db/redis → `createEmbeddingsModel(config.embeddings)` (`:207`) →
`runIndexer({ redis, db, embedder, config, logger, signal })` (`:225`) → sync → trimmer.
Add the enrichment model + dispatcher construction next to the embedder. The abort signal only
stops loops at iteration boundaries today — 7.2 threads it deeper (design decision above).

**`processUpdate.ts` (7.3 territory — do NOT touch)**: contains a byte-for-byte copy of the
old chunk→embed→upsert flow with placeholder writes (`:97-123`). **Place all new modules under
`packages/workers/src/enrichment/`** (sibling of `indexer/`/`sync/`) so 7.3 imports
`extractUrls`/`fetchUrl`/`enrich`/the embed-text helper and deletes its duplication. Also
export a small `upsertResourceRow`-style helper if it falls out naturally — 7.3's link-diff
will want it.

**Enrichment config (shipped, `config/index.ts:127-152`)**: `enrichment.language` (min 1),
`enrichment.llm { provider: 'anthropic'|'openai'|'custom', model, temperature, base_url?
(empty-or-URL refine; REQUIRED for custom via superRefine `:179-185`), api_key }`,
`enrichment.fetch { timeout_ms int>0, max_bytes int>0, max_redirects int≥0, user_agent min 1,
allowed_schemes nonempty array of 'http'|'https', block_private_ips boolean }`.
`export type EnrichmentConfig = HivlyConfig['enrichment']` (`:231`). Shipped example defaults:
`language: "en"`, anthropic `claude-sonnet-4-6` temp 0.3, `timeout_ms: 5000`,
`max_bytes: 2000000`, `max_redirects: 3`, `user_agent: "HivlyBot/1.0"`,
`allowed_schemes: ["https"]` (https-only default; the schema permits http too),
`block_private_ips: true`.

**Providers (`@hivly/shared/providers`)**: `createChatModel(agent: ChatModelConfig):
BaseChatModel` (`:50`; ChatAnthropic | ChatOpenAI with `configuration.baseURL` for custom),
`createEmbeddingsModel` (`:85`), `assertEmbeddingDimensions` (`:124`). Keys passed explicitly —
never rely on LangChain env lookup. Compose already plumbs `ENRICHMENT_LLM_API_KEY`/
`ENRICHMENT_LLM_BASE_URL` into the workers service (7.1); all services also get `.env` via
`env_file`.

**`embeddings` table (post-7.1)**: `id uuid PK · chunkKey text NOT NULL (unique
idx_embeddings_chunk_key — the UPSERT target, never id) · title/description/link text NOT NULL ·
embedding vector(dims) HNSW cosine · channelId text (idx, RBAC) · messageIds text[] (length 1;
[0] = anchor) · createdAt`. `user_read_status.embedding_id` FKs `embeddings.id` with NO cascade —
7.2 only inserts/upserts (no deletes), so no FK ordering concern here (7.3's purge owns that).

### SSRF guard — empirically verified facts (do not re-litigate)

Verified on undici 8.5.0 (behavior stable since 6.x; local Node 26.4.0 — the Docker image is
Node 24 LTS, undici 7.x; the explicit dep controls the version regardless):
1. `fetch(url, { dispatcher })` accepts a custom `Agent` — non-standard Node/undici extension,
   fully supported.
2. `Agent({ connect: { lookup } })` invokes the custom lookup for **hostname** targets and
   connects to exactly the addresses the callback returns → validating there defeats DNS
   rebinding.
3. `connect.lookup` is **NOT invoked for IP-literal hosts** (`http://127.0.0.1/` connected
   without any lookup call) → **Layer A literal pre-check is mandatory, not belt-and-braces**.
4. `new URL()` normalizes exotic encodings before you check: `http://2130706433/`,
   `http://0x7f.1/`, `http://017700000001/` → hostname `127.0.0.1`;
   `http://[0:0:0:0:0:ffff:169.254.169.254]/` → `[::ffff:a9fe:a9fe]`.
5. `BlockList.check(addr, 'ipv6')` matches IPv4-mapped IPv6 against IPv4 subnet rules
   automatically (`::ffff:169.254.169.254` hits the `169.254.0.0/16` rule).
6. `redirect: 'manual'` returns the REAL 3xx (`status: 301`, readable
   `headers.get('location')`) — undici intentionally diverges from the spec's
   `opaqueredirect`; the manual loop pattern works.
7. Streaming byte-cap via `res.body.getReader()` + `reader.cancel()` past the cap works;
   `Content-Length` may be absent or lying — early-reject only.

CVE-2026-22036 (undici < 7.18.0 unbounded decompression on fetch): mitigate with the explicit
≥ 7.18.0 dep (D3) + `Accept-Encoding: identity` + the decoded-byte cap. Import `Agent` (and
optionally `fetch`) from the `undici` package in `ssrfGuard.ts`/`urlFetcher.ts` so the patched
version is the one actually used — do NOT mix the package `Agent` with the global bundled
`fetch` (dispatcher compatibility across versions is not guaranteed; import `fetch` from
`undici` too).

### Enrichment — LangChain specifics

- `.withStructuredOutput(schema)` exists on `BaseChatModel` in `@langchain/core` 1.2 and is
  inherited by `ChatAnthropic`/`ChatOpenAI` (tool-calling under the hood). Known zod-4 caveat
  (repo pins zod ^4.4): TS inference through it can degrade to `Record<string, any>` — always
  re-`parse` the result with the Zod schema for both types and runtime safety.
- Custom OpenAI-compatible providers may lack tool calling → `withStructuredOutput` fails or
  emits garbage. Implement the documented fallback: plain `invoke` + "ONLY minified JSON"
  instruction + strip ```json fences + `JSON.parse` + Zod parse, one retry, then D1 failure.
- Feed the model the high-signal hints (title/meta/OG) FIRST, then the body text `htmlText`
  already truncated (its ~8k module-constant cap is the single body-text cap); `enrich.ts`
  owns only its own prompt-assembly cap constants (message text etc.). A title+description
  task needs the top of the page, not the whole document.
- Temperature/model come from config — no hardcoding. Log model output lengths, never full
  page text; never log `api_key`.

### URL extraction — the Discord-specific pitfalls

- `<https://example.com>` is Discord's suppressed-embed syntax — unwrap it (the `<`/`>` are
  not part of the URL). Markdown `[text](url)` puts the URL inside parens. Handle both BEFORE
  the bare-URL regex so delimiters don't truncate matches.
- Trailing punctuation (`Look at https://x.com/a.` / `(see https://x.com/b)`) must be stripped;
  balanced-paren heuristic for Wikipedia-style URLs.
- Normalization to `URL.href` is what makes "one row per URL" + the AC-7 refine + citation
  hrefs (7.5) all coherent — persist the href, never the raw match.
- Determinism is an AD-13 requirement: extraction over the same content must always yield the
  same ordered list (no Set-iteration-order tricks; dedup preserving first occurrence).

### Test landscape — what changes, what doesn't

- Root vitest `unit` project picks up any new `*.test.ts` under `packages/workers/src/`
  automatically; integration project (`workers-integration`) picks up `*.integration.test.ts`
  (15s timeouts, real PG/Redis at `postgres://hivly:changeme@127.0.0.1:5432/hivly` /
  `redis://127.0.0.1:6379`, env-overridable).
- Reuse patterns: `makeFakeDb` (hand-rolled fake Drizzle capturing inserted rows + RETURNING
  control via `stampMiss`), deterministic fake embedder keyed on magic strings, `sqlText()`
  flattener (in `processUpdate.test.ts:48-59`) if raw-SQL shape assertions are needed,
  `openTestClients()` + `runSuffix()` salt + fresh-`'$'`-group in integration.
- Untouched suites that must stay green: `consumer.test.ts`, `events.test.ts`, all `sync/*`
  tests, `trim/*` tests, everything in backend/web (the placeholder-policy fixtures there
  still parse — `''` links remain valid under AC-7).
- jsdom/web gotcha (only if you accidentally touch web — you shouldn't): no jest-dom matchers.
- Integration hygiene: stop compose app containers first; `assertNoCompetingWriter` does NOT
  catch a same-host `npm run dev -w @hivly/workers` — stop that too. **This Mac has TWO Redis
  instances** (Homebrew on :6379; compose Redis publishes no ports) — local runs hit Homebrew.

### Previous story intelligence (7.1 + inherited)

- 7.1 shipped the placeholder policy this story demolishes on the indexer side
  (`title:''/description:<old text>/link:''` — `indexBatch.ts` only; `processUpdate.ts` keeps
  it until 7.3). The 7.1 review explicitly deferred **robust URL validation to 7.2** (AC-7)
  and flagged the per-row `SearchFragmentSchema.parse` abort hazard in `ragRetriever`.
- 7.1 forward-documented `chunk_key = "<messageId>:<urlIndex>"` and length-1 `messageIds` in
  schema comments/docs ahead of code — **7.2 makes those comments true**; if any still read
  future-tense after implementation, fix the wording (AC-10).
- 6.4: graceful-shutdown budget (7s in-process, 35s compose) was sized for cheap batches —
  documented mitigation is abort-threading + PEL replay, not a bigger window. interpolateEnv
  substitutes `${VAR}` even inside YAML comments — irrelevant unless you touch the YAML files
  (you shouldn't; the enrichment block already shipped).
- OPS-1: the stream trimmer computes a PEL-safe MINID floor across groups — slower enriched
  batches just hold the floor back; no interaction to code for, but never ACK-early.
- OPS-2 standing DoD: env-gated smoke against the real LLM provider for any new LLM path
  (AC-9); revert-verify any new test that could "lie" (assert against the fake, not reality).
- 3.3 (superseded design, still instructive): the dimension guard + no-XACK rule originated
  there (epics.md:583) — it is a live invariant the rewrite preserves (AC-6).

### Git intelligence

Recent pattern: one commit per meaningful slice, PR per story, never auto-merge. Suggested
slices (Conventional Commits, English, imperative, ≤72 chars):
1. `feat(shared): harden fragment/citation link refine to URL.canParse` — AC-7 + tests.
2. `feat(workers): add URL extraction and SSRF-guarded UrlFetcher` — extractUrls, ssrfGuard,
   urlFetcher, htmlText + tests + the `undici` dep.
3. `feat(workers): add AI enrichment module for resource metadata` — enrich + tests.
4. `feat(workers)!: rewrite indexer as URL-enrichment pipeline` — indexBatch rewrite,
   grouping demolition, main.ts wiring + tests. Footer:
   `BREAKING CHANGE: the Indexer indexes only messages containing URLs; non-link messages are
   discarded. Existing environments require the Epic 7 clean-slate wipe + fresh ingest runbook
   (operational-backlog.md).`
5. `docs(repo): rewrite ingestion pipeline docs for the resource index` — AC-10.

### Project Structure Notes

- New code lives in `packages/workers/src/enrichment/` (importable by `sync/` for 7.3) and
  `packages/workers/src/indexer/`. No root `src/`, no new packages. ONE new dependency
  (`undici`, workers only — D3). No config schema changes, no migrations, no shared-contract
  changes beyond the AC-7 refine.
- If compilation pressure pushes you toward touching backend/web/bot or `processUpdate.ts`,
  STOP — that is 7.3/7.4 behavior leaking in. The only cross-package edits are the AC-7
  schemas + their tests.
- English only in code/comments/tests/commits/docs; `enrichment.language` affects generated
  content only.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-07-09.md §1 (decision table), §2.3 (SSRF red risk), §4.3, §5, Resolved items 2/4]
- [Source: _bmad-output/planning-artifacts/epics.md FR5 (:24), FR6 (:25), Épico 7 (:992-1011), NFR2/NFR6/NFR8/NFR17 (:46-67)]
- [Source: docs/context/ARCHITECTURE-SPINE.md AD-2, AD-8, AD-13 (+ Epic 7 ingestion-capability note), Deferred § batching/retry]
- [Source: docs/context/TECHNICAL-DESIGN.md §5.3, §7 (superseded banner names this story), §8, §13]
- [Source: docs/data-model.md §2 embeddings, write ownership, critical indexes]
- [Source: docs/base-standards.md §1 (tests-first for the Indexer pipeline), §2, §8]
- [Source: docs/backend-standards.md Redis Streams Patterns, Testing standards, tests-first list]
- [Source: docs/bmad-story-mandatory-steps.md §2, §3.1, §3.2, §3.5]
- [Source: _bmad-output/implementation-artifacts/7-1-shared-modelo-datos-contratos-config-enriquecimiento.md — Review Findings (link-refine deferral), Placeholder policy, Ripple map]
- [Source: _bmad-output/implementation-artifacts/operational-backlog.md — Epic 7 clean-slate runbook, P1.1/P2.2, standing DoD]
- [Tech: undici Client.md connect.lookup; undici #1622/#1193 (manual-redirect divergence); GHSA-g9mf-h72j-4rw9 (CVE-2026-22036); LangChain BaseChatModel.withStructuredOutput reference; langchainjs #8413 (zod4 inference)]

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- The unit-test fake DB's stamp simulation (`indexBatch.test.ts`) initially derived the RETURNING
  set from insert side-effects only — broke for the discard path (zero inserts, but the stamp
  must still gate on RETURNING). Fixed by extracting the message id directly from the
  `inArray(discordMessages.id, [messageId])` where-condition's `queryChunks` (drizzle wraps each
  array element in a `Param { value }`, not a raw string — empirically verified via a throwaway
  node script before committing to the extraction helper).
- Local `Hivly.config.yml` (gitignored, not a story deliverable) had `enrichment.llm.provider:
  "anthropic"` with a non-Anthropic-shaped `ENRICHMENT_LLM_API_KEY` (copy of the `agent`/
  `embeddings` blocks' custom-endpoint key) — the real-LLM smoke test failed until the local
  provider was switched to `"custom"` to match the working `agent`/`embeddings` blocks. Local-only
  fix, does not touch the tracked `Hivly.config.yml.example`.

### Completion Notes List

- **AC-1 `extractUrls`**: bare/angle-bracket/markdown forms, trailing-punctuation stripping with
  balanced-paren heuristic (Wikipedia-style URLs), uppercase-scheme normalization via `URL.href`,
  credential rejection, scheme allowlist, dedup-preserving-first-occurrence. 14 unit tests.
- **AC-2 `ssrfGuard`**: `createDefaultBlockList()` (14 IPv4 + 7 IPv6 ranges incl. CGNAT and
  IPv4-mapped-IPv6 matched automatically by `node:net`'s `BlockList`), Layer A IP-literal
  pre-check (mandatory — `connect.lookup` is never invoked for IP-literal hosts, verified
  empirically), Layer B `undici.Agent({connect:{lookup}})` using `dns.lookup(..., {all:true,
  verbatim:true})`. `createGuardedDispatcher(fetchConfig, blockList?)` factory, no module-level
  singleton `Agent` — built once in `main.ts`, injected. 18 unit tests.
- **AC-3 `urlFetcher`**: manual-redirect loop re-running the scheme allowlist + Layer A on every
  hop (defends the classic 301→metadata-IP bypass), `AbortSignal.any([timeout, shutdown])` per
  hop, streaming byte-cap reader (Content-Length is only a cheap early reject), typed
  `FetchOutcome` union that never throws. Deviated from the AC's abbreviated 3-arg signature by
  adding the injected `GuardedDispatcher` as a 4th param (AC-2's own text requires dispatcher
  injection, so the 3-arg listing was a simplification, not a literal contract). 11 unit tests
  against an ephemeral `node:http` server, incl. the AC-8-mandated redirect-re-check case with a
  custom BlockList that excludes loopback.
- **AC-4 `htmlText`**: zero-dep regex-tier title/meta/OG extraction + stripped/truncated body
  text (8,000-char cap); non-HTML `text/*` passthrough; `null` for unusable content types (PDF/
  image/binary) — the caller falls back to message-text-only. 12 unit tests.
- **AC-5 `enrich`**: narrow `EnrichmentChatModel` structural interface (mirrors the `Embedder`
  pattern) — real `BaseChatModel` from `createChatModel` is structurally assignable with zero
  casts (verified by `tsc`). Runtime fallback trigger (throw OR Zod-parse-fail) → ONE JSON-fallback
  attempt; empty title/description after trim/collapse = `EnrichmentError` on EITHER path, no
  further retry. Extended with an optional `signal` param (not in the original AC-5 text) so the
  shutdown AbortSignal reaches the LLM call too, per AC-6's end-to-end threading requirement. 12
  unit tests.
- **AC-6 `indexBatch` rewrite**: per-message resource pipeline replaces group/chunk/embed.
  `partitionByIndexState` relocated to `indexer/partition.ts`; `grouping.ts`/`grouping.test.ts`
  deleted; `MessageGroup` removed from `types.ts`; `main.ts`'s grouping clamp warning removed
  (chunk-size clamp kept — Sync still chunks until 7.3). Discard (no-URL / all-blocked) and
  resource-row persistence share ONE `persistMessage` transaction helper (rows/vectors empty for
  discard) so both paths use the identical RETURNING-gated stamp. `IndexBatchDeps`/`RunIndexerDeps`
  grew `enrichModel`/`guard`/`signal`; `main.ts` builds both once at boot via `createChatModel` +
  `createGuardedDispatcher` and injects them (never constructed inside `consumer.ts`/`indexBatch.ts`).
  23 unit tests (mocking only the `fetchUrl`/`enrich` module boundary — `extractUrls`/`extractPageHints`
  run for real).
- **AC-7 shared `link` refine**: new `schemas/linkRefine.ts` (`isEmptyOrHttpUrl`, parse-based —
  rejects embedded whitespace, host-less `https://`, non-http(s) schemes; case-insensitive by
  construction via `URL`). Wired into `SearchFragmentSchema`/`DocumentFragmentSchema`/
  `CitationSchema`, replacing the old prefix-regex refine. `link: ''` fixtures across
  backend/web/e2e stay green (verified).
- **AC-9 integration**: rewrote `indexBatch.integration.test.ts` against real Postgres+Redis; the
  SSRF guard and `fetchUrl` run for REAL against an ephemeral local HTTP server (loopback,
  `block_private_ips:false` — documented dev-only escape hatch) — only the LLM is faked via an
  injected `EnrichmentChatModel`, exercising `enrich.ts`'s real prompt/normalize logic. 5 cases:
  URL→real row+stamp+PEL-drained, no-URL→discard, redelivery convergence (UPSERT), enrichment
  failure→PEL/indexed_at NULL, BUSYGROUP tolerance (unchanged). Env-gated real-LLM smoke
  (`enrich.smoke.test.ts`, `ENRICHMENT_SMOKE=1`) run once locally — evidence below.
- **AC-10 docs**: TECHNICAL-DESIGN.md §7 rewritten (removed Superseded banner, new mermaid with
  the D1/D2 failure classification), §5.3 Indexer pseudocode rewritten, §17 batching row marked
  superseded. ARCHITECTURE-SPINE.md AD-13 note flipped to present tense, Deferred batching entry
  marked superseded. data-model.md `embeddings` field notes updated to present tense. PRD.md
  `Fragmento` glossary + `knowledge` config sample comment updated (incremental per the pivot
  note's own instruction — 7.3–7.6 continue the rest). `schema.ts` comments already present-tense
  (no "will" wording) — no edit needed. Added operational-backlog.md P2.5 (FR21 knowledge-lifecycle
  notification deferral — the 6.4 Notifier is crash-alerts-only by design and `indexBatch` must
  not emit notifications per this story's own scope note).
- **Real-LLM smoke evidence** (`ENRICHMENT_SMOKE=1`, local `custom` provider, 2026-07-09):
  ```json
  {
    "title": "Great Resource for Learning TypeScript",
    "description": "This resource is recommended for individuals looking to learn TypeScript. It serves as a valuable guide for mastering the language."
  }
  ```
- **Verification gate (all green)**: lint 0 / unit+web 774 passed + 1 skipped (the smoke test,
  correctly gated) / build clean (5 packages) / integration 111 passed (19 files, backend+bot+
  workers, app containers stopped first, no pre-existing flakes this run) / e2e 13 chromium specs
  unchanged pass count. `undici` appears only in `packages/workers/package.json` (verified via grep).
- No config schema changes, no migrations, no shared-contract changes beyond the AC-7 refine —
  confirmed by diff review before commit.

### File List

**New:**
- `packages/workers/src/enrichment/extractUrls.ts` + `.test.ts`
- `packages/workers/src/enrichment/ssrfGuard.ts` + `.test.ts`
- `packages/workers/src/enrichment/urlFetcher.ts` + `.test.ts`
- `packages/workers/src/enrichment/htmlText.ts` + `.test.ts`
- `packages/workers/src/enrichment/enrich.ts` + `.test.ts` + `.smoke.test.ts`
- `packages/workers/src/indexer/partition.ts` + `.test.ts`
- `packages/shared/src/schemas/linkRefine.ts` + `.test.ts`

**Modified:**
- `packages/workers/src/indexer/indexBatch.ts` (full rewrite — resource pipeline)
- `packages/workers/src/indexer/indexBatch.test.ts` (full rewrite)
- `packages/workers/src/indexer/indexBatch.integration.test.ts` (full rewrite)
- `packages/workers/src/indexer/consumer.ts` (`RunIndexerDeps` gains `enrichModel`/`guard`; both
  `indexBatch` call sites pass them + `signal`)
- `packages/workers/src/indexer/consumer.test.ts` (fakes for the new deps)
- `packages/workers/src/indexer/types.ts` (`MessageGroup` removed)
- `packages/workers/src/main.ts` (build `enrichModel`/`guard` at boot; remove the grouping clamp
  warning; keep the chunk-size clamp)
- `packages/workers/package.json` (`undici` ^7.28.0 added)
- `packages/shared/src/schemas/search.ts`, `documents.ts`, `citation.ts` (link refine swapped to
  `isEmptyOrHttpUrl`)
- `packages/shared/src/schemas/search.test.ts`, `documents.test.ts`, `citation.test.ts` (reject/
  accept cases for the hardened refine)
- `docs/context/TECHNICAL-DESIGN.md`, `docs/context/ARCHITECTURE-SPINE.md`, `docs/data-model.md`,
  `docs/context/PRD.md` (AC-10 sync)
- `_bmad-output/implementation-artifacts/operational-backlog.md` (P2.5 added)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status tracking)
- `package-lock.json` (undici + transitive deps)

**Deleted:**
- `packages/workers/src/indexer/grouping.ts` + `.test.ts` (demolished per D4; `partitionByIndexState`
  relocated first)

## Change Log

| Date | Change |
|---|---|
| 2026-07-09 | Story created via bmad-create-story (ultimate context engine; 4 forks confirmed with Borja: D1 LLM-failure→PEL, D2 SSRF-blocked→skip, D3 +undici, D4 knowledge/chunking retire in 7.3). Status: ready-for-dev. |
| 2026-07-09 | Story implemented via bmad-dev-story. All 8 tasks complete, all 11 ACs satisfied. Gate green: lint 0 / 774 unit+web (+66) / build clean (5 pkgs) / 111 integration (19 files) / 13 e2e chromium unchanged. Status: ready-for-dev → review. |
