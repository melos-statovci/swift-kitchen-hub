# Shared-core verification — 4 October 2026

| Check | Result |
| --- | --- |
| Backend unit suite | PASS, 121 tests / 12 files |
| Real PostgreSQL integration | PASS, 5 complete scenarios, both independent databases |
| Backend typecheck/static lint | PASS, includes source, seeds, scripts and integration tests |
| Backend build / Prisma schema validate | PASS |
| Backend and Hub format checks / git diff checks | PASS |
| Hub unit suite | PASS, 83 tests |
| Hub typecheck / production build | PASS |
| Hub full ESLint | PASS, zero errors; 7 existing Fast Refresh warnings |
| Secret-pattern scan | PASS, tracked/reviewable files; private local envs ignored |
| Browser DUA-style configuration | PASS, 1440/768/390, operational and management routes |
| Browser synthetic flat configuration | PASS, same matrix/source, no manufactured variants |
| Independent final review | No outstanding material findings after fixes |

The real database suite launches `dist/server.js` twice from the same compiled worktree, with separate environment objects/database URLs/secrets/ports. Final compiled JavaScript tree SHA256: `b45610aa3f28e82a143e821f7623e03d54eabdf51ea6ef4ec833198de2f7fa60`. Both Hubs run the same working source tree under two Vite modes; only deployment configuration and DB fixture data differ. Backend schema and all six migration files are identical to the approved baseline; the tests apply the actual migration files, preserve a pre-sixth legacy order, and test PostgreSQL constraints and concurrent transactions.

New coverage includes destructive-tool target/ack/URL override refusal; runtime database host/port/name consistency, duplicate query parameters, explicit production environment label, distinct CORS allowlists and cross-runtime HTTP/socket token rejection; aggregate and standalone menu invariants/edit version invalidation; authoritative flat/required/mixed pricing, history, fulfillment and role-scoped realtime. Existing Hub regression tests retain late-response protection, created/updated/removed reconciliation, recovery and duplicate-action behavior. Observable component tests add historical mixed Kitchen/Archive rendering; time regressions cover configured zone, locale and DST.

Browser observations: Both default; Buttons only persists on reload; Quick tap advances; reverting to Both succeeds. Flat create/reprice and all-unavailable REQUIRED edit succeed. Archive shows original snapshots after catalog changes. Pickup is visible operationally and absent from Deliveries. Stopping the synthetic API shows stale loaded orders; failed Retry retains them; restarting reconnects and clears the warning. Anonymous `/` reaches login and signed-in `/` reaches the role home after the browser-only redirect fix. Responsive stage boards retain intentional internal scrolling with no document overflow at measured widths.

Review fixes: guarded legacy DUA migrate/seed and Studio paths; checked both URLs before destructive clients/CLI; replaced unsafe remote setup notes with local-only instructions; strengthened runtime effective-port/duplicate-parameter checks with failing regressions; added real CORS assertions. Independent final follow-up found no further material issue. Reviewer read code/diffs and did not independently rerun the root's test/browser evidence.

Remaining debt: the current npm audit reports backend 4 affected packages (1 high, 2 moderate, 1 low) and Hub 13 (10 high, 2 moderate, 1 low). These remain in the inherited dependency graph; broad upgrades were outside this milestone. Backend test-client and formatter are new development dependencies. One intermediate pre-existing Supertest run returned ECONNRESET; the immediate rerun and final complete suite passed without a retry wrapper. Mechanical formatting changes in baseline files are confined to the new worktrees. This is a local review milestone; production deployment, load testing and Le Sandwich adaptation are separate work.

Canonical dirty main checkouts retain their original HEADs/status entries. Both protected DUA phase-two worktrees remain clean at their exact reference commits. No push, merge, deployment, storefront edits, production database access or destructive Le Sandwich seed execution occurred.
