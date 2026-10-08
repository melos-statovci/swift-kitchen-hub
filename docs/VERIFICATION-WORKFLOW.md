# Verification

Use Node **24.8.0** and install each repository with `npm ci`. Generate the backend client with `npm run prisma:generate` after schema/dependency changes. Verification never installs dependencies or starts databases automatically.

| Command                                   | Use                                                 | Scope                                                                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:quick`                    | Normal development / small commit                   | Repository unit tests, types, lint, formatting, runner safety tests, `git diff --check HEAD`                                                                                |
| `npm run verify:full`                     | Before push / PR / staging review                   | Quick checks plus production build; backend adds Prisma and guarded PostgreSQL integration; storefront adds browser types and Playwright; Hub has no database/browser suite |
| `npm run verify:ci`                       | CI's independent checks                             | Quick checks plus build and backend Prisma; browser types run in the gated browser job                                                                                      |
| `npm run verify:plan`                     | Inspect full orchestration without executing checks | JSON plan; no servers, clients, builds or resets                                                                                                                            |
| `npm run verify:runner`                   | Changing verification logic                         | Runner safety/CI filtering tests only                                                                                                                                       |
| Backend: `npm run verify:workspace:quick` | Quick verification across all three repositories    | Independent repository checks in parallel, at most three commands per stage                                                                                                 |
| Backend: `npm run verify:workspace:full`  | Complete cross-system verification                  | All quick checks, Hub/storefront builds, Prisma, backend build + integration, browser types, browser proof                                                                  |
| Backend: `npm run verify:integration`     | Only database proof was invalidated                 | Guarded PostgreSQL tests, including their existing backend build                                                                                                            |
| Backend: `npm run verify:preflight`       | Check heavy-run readiness                           | Existing database guard, lock and occupied service-port checks; no database connection/reset                                                                                |
| Storefront: `npm run verify:browser`      | Only browser proof was invalidated                  | Backend prerequisite build, browser types and the complete existing Playwright suite                                                                                        |

Backend lint is already an alias for the same TypeScript check; the runner reports **types / lint** once. Storefront formatting checks source/code, browser tests, configuration and these workflow files. Its pre-existing `src/routes/README.md` formatting issue is outside that code check. No secret scanner was found: diff checks are whitespace checks, not a substitute for reviewing staged files for secrets.

## Local cross-system setup

The existing browser fixtures require these **sibling directory names**:

```text
resilient-published-menu-backend/
resilient-published-menu-hub/
resilient-published-menu-storefront/
```

The feature worktrees already have that layout. Cross-system commands use the current files in those directories, not remotely fetched branches. Backend-only full verification and Hub quick/full do not require all siblings.

Inspect the complete workspace plan with:

```sh
# In backend
npm run verify:workspace:full -- --plan
```

Stop any manually started owner-review services with their existing controller before heavy verification. For the current owner session, the local controller is:

```sh
node .superpowers/resilient-owner/services.mjs stop
```

The runner refuses heavy checks while **31041, 31042, 4173, 4174, 8083 or 8084** is listening. It never kills/reuses an unrelated service. All heavy commands share the backend's `.verification/heavy.lock`; inspect its `owner.json` and verify the process stopped before removing a stale lock.

If the disposable databases are absent, start only the existing proof stack from backend:

```sh
npm run db:up:shared
```

This is an explicit developer action, not part of quick verification. Docker/OrbStack must be available for local database proof; installed Chrome must be available for local Playwright.

## Destructive checks and allowed targets

**Full backend/workspace verification, integration verification and browser verification are destructive to the disposable fixtures.** The existing suites reset/seed the two test databases, and browser tests create synthetic orders and change synthetic settings. Back up any owner-review fixtures you intend to keep before running them. Quick, CI fast checks, plans, runner tests and preflight do not reset PostgreSQL.

The original `assertDisposableDatabaseEnvironment` is invoked from source before any heavy check, then reused by the existing database/browser infrastructure. Its exact allowlist remains:

| Database                        | Loopback port |
| ------------------------------- | ------------- |
| `swiftkitchen_shared_dua_test`  | `55441`       |
| `swiftkitchen_shared_flat_test` | `55442`       |

Both `DATABASE_URL` and `DIRECT_URL` must identify the same allowed database/port on localhost/127.0.0.1/IPv6 loopback, with the existing test/local environment and `LOCAL_DATABASE_ACK=I_UNDERSTAND_DISPOSABLE_LOCAL_ONLY`. Only the checked-in `.env.shared-dua.example` / `.env.shared-flat.example` test targets are used by proofs. Prisma schema validation receives dummy local URLs and does not connect to a database.

**Never point verification/reset/integration/browser commands at DUA dev port 55432, remote databases, staging or production.** Do not change the guard to accommodate another environment. Verification does not use DUA development, provider or deployment commands.

## Output and failure logs

Every run prints concise PASS/FAIL lines and a log directory:

```text
.verification/logs/<timestamp>-<pid>/
```

Full stdout/stderr is retained per check. `results.json` records check names, exit codes and paths. Failure prints the check, log path and a short tail, then exits nonzero; later dependent stages stop. Independent checks already running in the failed stage finish and retain their logs. Commands have a 20-minute timeout; interruption terminates only spawned process groups and releases the heavy lock.

Read a failed log, reproduce that specific failure, fix it, then rerun only the invalidated checks. Generated logs, lock files and browser artifacts are ignored and must not be committed. CI uploads only verification/test artifacts with seven-day retention, including hidden verification logs; it does not upload `.env` files or owner SQL backups.

## GitHub Actions

The remotes are GitHub repositories. No tracked CI configuration was found in the existing checkouts, so `.github/workflows/verification.yml` uses GitHub Actions. Its graph is:

```text
changes → backend / Hub / storefront fast checks (parallel)
        → after all fast checks pass: integration / browser (parallel, isolated runners)
```

Each fast job runs existing unit/type/lint/format/build commands through the runner. Backend also validates Prisma. Browser types run before Playwright. Each heavy job gets separate ephemeral PostgreSQL 16 services exposed on loopback 55441/55442, with only public synthetic proof credentials. Browser uses local Vite/API/Hub services and the existing Chrome Playwright configuration. npm's download cache is keyed by checked-out lockfiles. No deployment job exists.

For **only `docs/` files or root Markdown files**, only the changed repository's fast job runs and both heavy jobs are skipped. Any code, contract, lockfile, schema/migration, script, workflow/configuration or unknown file triggers all three fast jobs and both heavy jobs. Unknown/missing base history and manual dispatch run the complete graph. Push and PR runs for the same source branch share a concurrency group; a newer run cancels the older run.

The current repository uses its event checkout (the PR merge checkout on PRs). Companion identities are explicitly pinned in `.github/verification.json` to the owner-fix commits; update pins deliberately when companion code changes, including coordinated PRs. Fixed snapshots verify those exact versions, not unpushed changes or another PR's current head.

**Owner setup remains required before remote use:** push reviewed companion commits and workflow changes, then provide `SWIFTKITCHEN_READ_TOKEN` with read-only contents access limited to these three private repositories. Do not grant deployment/provider/database permissions. GitHub's default token is scoped to its own repository and cannot read the other private repositories ([checkout documentation](https://github.com/actions/checkout#checkout-multiple-repos-private)). Missing access fails explicitly; fork PRs cannot receive this secret and need an owner-reviewed run. This local task creates no secret, changes no settings and starts no remote pipeline.

The common runner, common tests, changes classifier and setup action are intentionally copied into three independent repositories; keep their copies synchronized when editing them. Backend owns the additional guard tests.

## Codex agent rule

> Prefer the repository verification scripts instead of manually rerunning individual full suites. Read detailed logs only for failed checks. Do not rerun an already-passing expensive suite unless source affecting that proof changed or a failure requires reproduction.

Record the source/commit proven, command, result and log location. Unit/UI/fixture changes alone do not automatically invalidate an existing publication-transaction proof. Test/verification-script-only corrections do not justify rerunning unrelated expensive scenarios. An intentional browser contract change should strengthen tests for the new behavior while retaining safety assertions. Use a full run when the cross-system source proof is actually invalidated, not merely to repeat a previously green checklist.
