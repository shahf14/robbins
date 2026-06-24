# Improvement Plan (for Cursor)

A sequenced backlog. **Do one task per branch/commit**, verify green, then move on.
Tasks are ordered by ROI and dependency. Each task is self-contained.

---

## 0. Read first — project conventions (apply to every task)

**Stack:** Next.js 16 (App Router), React 19, single-user local PWA, `better-sqlite3`
(synchronous), zod. One shared DB handle via `getDb()` in `src/lib/db/sqlite.ts`;
DB file at `<root>/data/life-coach.db`. Routes in `src/app/api/**/route.ts` delegate to
repositories in `src/lib/**`.

**Migration discipline (critical):**
- Schema migrations live in `src/lib/db/migrate.ts` as a versioned ledger gated by
  `PRAGMA user_version`.
- **Add a new column ONLY as a new entry in the `MIGRATIONS` array with the next version
  number.** Never edit the `applyBaseline` (v1) step to add columns — the baseline is
  skipped on any DB already past v1, so the change would silently never apply. Use the
  idempotent `addColumn(db, table, name, def)` helper.
- Fresh DBs also get tables from `SCHEMA_SQL` in `src/lib/db/schema.ts`. If you add a
  column, prefer the migration as the single source; avoid duplicating defaults/types in
  both places (they can drift).

**Transactions + the async/sync trap:**
- Most repository functions are declared `async` but have **synchronous** bodies.
- `better-sqlite3` transactions (`getDb().transaction(fn)()`) MUST be synchronous. You
  cannot `await` inside, and a rejected promise from an `async` call inside will NOT roll
  the transaction back.
- To make a multi-write atomic, extract a **synchronous core** of any `async` helper and
  call the sync core inside the transaction. Existing examples to copy:
  `createAiInsightSync`, `ensureCommitmentDailyStepsSync`, `updateUserParticipantProfileSync`.

**Testing:**
- Test seam: `setDbForTesting(db)` + `initializeDatabaseConnection(db)` let you run repo
  code against `new Database(':memory:')`.
- `src/lib/morning-ritual-storage.test.ts` is the **living frontend/spec test** (string +
  behavior assertions). When you add or change an invariant, add/repoint an assertion there.

**Verify commands (npx/`tsc` bin resolution is occasionally flaky on this machine — use
these reliable forms):**
```bash
# typecheck
node ./node_modules/typescript/bin/tsc -p tsconfig.typecheck.json --noEmit
# lint specific files
node ./node_modules/eslint/bin/eslint.js <files...>
# tests (the 4 real scripts)
npm run test:formulation-migration
npm run test:frontend-audit
npm run test:api-error
npm run test:generate-daily-steps-scope
# if you hit `ERR_DLOPEN_FAILED` / "not a valid Win32 application" on better-sqlite3:
npm rebuild better-sqlite3
```
**Done when** = typecheck clean + lint clean + all 4 test scripts pass.

> Several items below say "verify first" — the codebase changed a lot recently, so confirm
> the bug still exists before fixing.

---

## Phase A — Backend correctness (small, high value) — do these first

### A1. Reflection re-save must not wipe AI analysis columns
- **Verify:** open `src/lib/life-coach/reflection-insight-repository.ts` → `upsertDailyReflection`.
  If it still uses `INSERT OR REPLACE` and omits `analysis_json` / `analyzed_at` /
  `adjustment_applied_at`, the bug is live (re-saving a reflection nulls the AI analysis
  written separately by `saveReflectionAnalysis`).
- **Steps:**
  1. Convert to `INSERT … ON CONFLICT(user_id, date) DO UPDATE SET …`, updating ONLY the
     user-supplied columns (mirror `bulkUpsertCheckins` in `src/lib/db/repositories/checkins.ts`).
  2. Leave `analysis_json` / `analyzed_at` / `adjustment_applied_at` out of the update list
     so they're preserved.
  3. Wrap the read+write in `getDb().transaction(...)`.
- **Test:** add a `:memory:` test (via `setDbForTesting`): insert reflection → set
  `analysis_json` → re-`upsertDailyReflection` → assert `analysis_json` survived.

### A2. `bulkUpsertMorningRituals` must not reset `created_at` on re-sync
- **File:** `src/lib/db/repositories/gratitude.ts`.
- **Verify:** if `bulkUpsertMorningRituals` uses `INSERT OR REPLACE`, `created_at` is lost on
  every re-sync (sibling of the already-fixed checkins bug).
- **Steps:** convert to `ON CONFLICT(id) DO UPDATE SET …` excluding `created_at` from the
  update list. Keep the gratitude-children rebuild inside the existing transaction.

### A3. Cron per-user error isolation
- **Files:** `src/app/api/cron/life-coach/daily-steps/route.ts`,
  `src/app/api/cron/life-coach/weekly-review/route.ts`.
- **Problem:** the whole `for (const userId of userIds)` loop is in one try/catch, so one
  user's throw aborts the batch.
- **Steps:** wrap the per-user body in its own try/catch; on error `console.error` + `continue`;
  accumulate `failedCount` / `errors[]` and return them in the JSON response.

### A4. Weekly-review cron idempotency ordering
- **File:** `src/app/api/cron/life-coach/weekly-review/route.ts`.
- **Problem:** focus refresh runs before the insight marker (`hasWeeklyReviewForPeriod` keys
  off the insight), so a throw between them makes a re-run repeat the AI call + focus refresh.
- **Steps:** write the insight (idempotency marker) first, or make the focus refresh
  idempotent per period.

### A5. Stop leaking internal error text to clients
- **File:** `src/lib/life-coach/server.ts` (`jsonError(message, status, details)`), used by
  ~50 routes that pass `String(error)` as `details`.
- **Steps:** in `jsonError`, only include `details` when
  `process.env.NODE_ENV !== 'production'`. (Single change; no route edits needed.)
- **Test:** add an assertion that the function drops `details` in production mode.

### A6. Validate + size-cap the free-form session POST bodies
- **Files:** `src/app/api/evening-reset/route.ts`, `src/app/api/morning-rituals/route.ts`.
- **Problem:** bodies are cast from `request.json()` with only a shape check (no zod, no size
  cap) then stored as `session_json`.
- **Steps:** add a zod schema for each body + a reasonable size/length cap; return
  `badRequest`/`payloadTooLarge` on violation. Mirror the validated routes (e.g. daily-steps).

### A7. Don't re-stamp `onboarding_completed_at` on curated insert
- **File:** `src/app/api/life-coach/curated-daily-tasks/route.ts` (calls
  `markUserOnboardingComplete` on every insert).
- **Steps:** in the user-profile write, use
  `onboarding_completed_at = COALESCE(onboarding_completed_at, ?)` so the original timestamp
  is preserved.

---

## Phase B — Data ownership / single-source-of-truth (decide, then implement)

> These have cross-device data-divergence risk. Get a product decision on each before coding.

### B1. Sync ALL preferences to the server (currently lost on a new device)
- **Problem:** `display_name`, `timezone`, `available_time_per_day`, `intensity_preference`,
  `behavioral_analytics_enabled` live only in localStorage and never reach SQLite.
- **Steps:**
  1. Add the missing columns to `users` (new **migration version**, per §0) + `SCHEMA_SQL`.
  2. Extend `updateUserParticipantProfile` / `/api/life-coach/profile` to read/write them.
  3. Include them in `syncUserPreferencesToServer` (`src/lib/sync-schedule-to-server.ts`).
  4. Change the save flow to **server-write-first, then hydrate localStorage from the
     response** (in `src/components/settings-panel.tsx` `savePreferences`).
- **Decision:** confirm which fields are worth persisting server-side.

### B2. Make SQLite the source of truth for ritual content (affirmations/identities)
- **Problem:** `fetchRitualContent` (`src/lib/morning-ritual-storage.ts`) reads
  `localStorage ?? SQLite`, so stale local can shadow/clobber a newer server copy.
- **Steps (needs a timestamp to reconcile safely):**
  1. Add `updated_at` to `ritual_content` (migration) and return it from
     `/api/morning-rituals/content`.
  2. Store an `updatedAt` alongside the localStorage copy in `saveAffirmations`/`saveIdentities`.
  3. In `fetchRitualContent`, prefer whichever is newer; treat localStorage strictly as a
     write-ahead queue (flush → delete → read server).
- **Decision:** confirm the timestamp approach vs. accepting current behavior.

### B3. Server-authoritative onboarding feature-gating
- **Note:** onboarding *completion* reconciliation is already bidirectional
  (`applyServerOnboardingStatus`). Remaining: `src/hooks/use-feature-unlock.ts` and
  `daysSinceOnboarding` still read localStorage only.
- **Steps:** drive unlock timing from the server `completedAt` (already fetched via
  `fetchServerOnboardingStatus`) instead of local state.

---

## Phase C — Architecture carves (dedicated PRs, larger)

### C1. Carve `src/lib/life-coach/repository.ts` (1073 lines) by aggregate
- **Steps:**
  1. Pick a layout (see C2 decision).
  2. Move the formulation state machine (`patchFormulationSession`, the big `switch`,
     `completeFormulationSession`, reset/empty helpers) into `src/lib/formulation/session-service.ts`.
  3. Move goal business rules (`updateGoal`, `createGoalBundle`) into a `goal-service` over
     `src/lib/db/repositories/goals.ts`.
  4. Keep `repository.ts` as a thin barrel (or delete it and import leaves directly).
- **Verify:** typecheck + all tests after each move (do it in small slices).

### C2. Standardize repository location + unify goal persistence
- **Decision:** one convention — data-centric (`lib/db/repositories/<table>.ts`) OR
  feature-centric (`lib/<feature>/repository.ts`).
- **Steps:** consolidate goal persistence (currently split across
  `lib/db/repositories/goals.ts` and `lib/life-coach/repository.ts`) into one owner; document
  the convention in this file.

### C3. Make `types.ts` type-only
- **Context:** value constants already live in `src/lib/life-coach/constants.ts`;
  `types.ts` re-exports them for compat (fan-in ≈ 223).
- **Steps:** migrate value-consumers to import from `constants.ts`; move `DOMAIN_CATEGORIES`
  (still a value in `types.ts`) to `constants.ts` (use a type-only import of `LifeDomain`);
  then `types.ts` can drop the value re-exports and become `export type` only. Broad but low
  individual risk — do in batches, typecheck between.

---

## Phase D — Reproducibility / tooling

### D1. Reproducible Docker install
- **Verify:** the Dockerfile may already use `npm ci` + an audit gate (there's a passing
  assertion for it). If not: generate a Linux-complete lockfile (run install once in
  `node:24-alpine`) and switch the Dockerfile to `npm ci`.

### D2. Pin the base image by digest
- **File:** `Dockerfile` — change `node:24-alpine` → `node:24-alpine@sha256:<digest>` in all
  stages; bump deliberately.

### D3. Pin the Node version
- Add `"engines": { "node": ">=20 <27" }` to `package.json` and a `.nvmrc` (`24`).
  (better-sqlite3 requires Node 20–26.)

### D4. `@types/better-sqlite3` → devDependencies
- **Verify:** there's a passing test asserting it's dev-only; if it's still under
  `dependencies` in `package.json`, move it to `devDependencies`.

### D5. Migrations as a deploy step + converge the two-source schema
- Move the lazy "migrate on first request" to an explicit startup/deploy step; make
  `SCHEMA_SQL` the source for fresh DBs and migrations the only source for column additions.

---

## Phase E — Scaling redesign (Step 8) — ONLY if going multi-user

Currently fine for single-user/single-container. Each is a redesign:
- **E1.** Externalize the DB (Postgres / libSQL / LiteFS) — the single local SQLite file is a
  SPOF and blocks horizontal scaling; keep the `dbAll/dbGet/dbRun` seam as the swap boundary.
- **E2.** Async/pooled access — synchronous better-sqlite3 blocks the event loop under
  concurrency.
- **E3.** Queue/fan-out cron — the per-user loop with 15s AI calls has a wall-clock ceiling.
- **E4.** DB-back the per-minute log rate limiter (`src/app/api/log/route.ts` in-memory `Map`)
  and ship logs to stdout instead of local `logs/`.

---

## Suggested execution order
1. **Phase A** (A1–A7) — small, high-value correctness. ✅ start here.
2. **Phase B** — after product decisions (B1/B2 are the only real cross-device data risks).
3. **Phase D** (D2–D4 are quick wins).
4. **Phase C** — dedicated PRs when there's appetite for structural work.
5. **Phase E** — deferred until multi-user is a real goal.
