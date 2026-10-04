# Shared Core Hub Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task; use a fresh read-only whole-branch reviewer before the owner handoff.

**Global constraints:** All changes remain in feat/shared-core-hub or feat/shared-core-backend. No push/deploy/main merge, protected/legacy checkout edits, Le Sandwich production access, storefront consolidation, tenancy or restaurant-identity domain branches. Preserve the protected DUA behavior. Tests precede behavior changes.

**Goal:** Preserve Direction A as the shared Hub and make configuration/time display consistent.
**Architecture:** Existing TanStack Start/React operational Hub; build-time deployment config; backend contract unchanged apart from agreed menu invariants.
**Tech stack:** React 19, TypeScript, Vite/TanStack Start, existing node unit tests.
**Spec:** ../specs/2026-10-04-shared-core-design.md

## Review Focus

- UTC instants must retain their identity across timezone and DST boundaries.
- Date filters and business-day counts must agree with displayed business dates.
- Flat and variant historical ticket rendering must use snapshots after menu edits.
- Sold-out required products must be editable without fake available variants.
- Browser-local Kitchen preference and realtime reconciliation must remain intact.

### Task 1: Characterization and shared display/configuration

**Files:** src/lib/businessTime.ts and .test.mjs; src/lib/format.ts; src/routes/_authenticated/archive.tsx; src/hooks/useArchive.ts if business date boundaries require it; src/components/admin/MenuFormDialog.tsx; src/lib/menuFormSchema.ts and tests; src/lib historical ticket tests; .env.shared-*.example.
**Interfaces:** Formatting accepts UTC timestamp strings and uses configured locale plus IANA business timezone; required variant validation accepts >=1 priced nonarchived option even if all unavailable.

- [x] Confirm baseline 73 tests and add observable flat/variant historical ticket characterizations using real components.
- [x] Write failing timezone/DST/browser-zone cases before implementing reusable display/day-boundary helpers.
- [x] Replace browser-local operational/archive timestamp and business-day assumptions where appropriate without changing stored instants or importing analytics.
- [x] Align editor validation with backend sold-out REQUIRED contract; add regression coverage.
- [x] Keep generic deployment values configurable; leave legitimate DUA fixtures intact and preserve all Kitchen/realtime tests.
- [x] Run whole unit suite/typecheck/build/lint/format/diff checks and record results in the ledger.
- [x] Commit locally after owner coordination.

### Task 2: Independent local browser proof

**Consumes:** Backend Task 3 synthetic APIs; same Hub source, two Vite configurations.

- [x] Run DUA-style identity/EUR/sq-XK/Europe-Belgrade and synthetic flat identity/EUR/en-GB/different business timezone against separate APIs/databases.
- [x] Verify login, Acceptance/Kitchen/Deliveries/Archive/Menu/Settings/Staff, flat/variant snapshots and pickup exclusion using synthetic data.
- [x] Check 1440px desktop, 768px tablet and 390px mobile without expanding the matrix unless an issue appears.
- [x] Verify reconnect/realtime updates, error/loading/empty recovery and all three device-local Kitchen modes.
- [x] Record pass/fail evidence and local review/start instructions; no push/deploy.

### Task 3: Independent final review and owner handoff

- [x] Fresh read-only whole-branch review with spec/plan/diff/evidence, narrowly resolve material feedback, verify and report local HEAD/state.
