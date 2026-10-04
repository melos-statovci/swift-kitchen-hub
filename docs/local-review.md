# Shared SwiftKitchen local review

Source branches/worktrees: `feat/shared-core-backend` at `.worktrees/shared-core-backend` and `feat/shared-core-hub` at `.worktrees/shared-core-hub`. Starting references are backend `e6b603b07d37ab1061738aa050b3fad914beac0e` and Hub `1a4ddd46945371bea76060cf8fa527d1705c8f92`.

## Same-source proof

Both APIs run the identical compiled `dist/server.js` from this backend worktree. Both Hubs run the identical source tree from the Hub worktree; only Vite deployment environment values differ. No restaurant-specific domain branches, tenant IDs, shared restaurant database or duplicated app source were added.

| Configuration | Database / loopback port | API | Hub | Locale / business zone | Catalog |
| --- | --- | --- | --- | --- | --- |
| DUA-style synthetic rehearsal | swiftkitchen_shared_dua_test / 55441 | 31041 | 8083 | sq-XK / Europe/Belgrade | DUA required pizzas plus real flat items |
| Generic flat synthetic rehearsal | swiftkitchen_shared_flat_test / 55442 | 31042 | 8084 | en-GB / America/New_York | Synthetic sandwiches/drinks, NONE, no fake variants |

Both use EUR and distinct PostgreSQL users/passwords, JWT secrets, CORS allowlists, settings, staff and orders. These databases are disposable tmpfs containers created by `docker-compose.shared.yml`; the existing DUA development container on 55432 was not changed.

## Repeat locally

In backend: copy both shared examples to matching `.local` files, run `npm run db:up:shared`, then `npm run test:integration`. That command resets only the two exact acknowledged disposable targets. Stop both proof APIs before rerunning integration to avoid listener conflicts. Build once (`npm run build`), then start `npm run proof:dua` and `npm run proof:flat` in separate terminals. `npm run proof:demo` adds synthetic browser tickets across operational stages. The start wrappers load explicit file values after inherited variables and validate targets before launching.

In Hub: copy `.env.shared-variant.example` to `.env.shared-variant.local` and `.env.shared-flat.example` to `.env.shared-flat.local`. Start the same worktree twice:

```sh
npm run dev -- --host 127.0.0.1 --port 8083 --mode shared-variant
npm run dev -- --host 127.0.0.1 --port 8084 --mode shared-flat
```

Open `http://127.0.0.1:8083/` or `http://127.0.0.1:8084/`. Synthetic accounts are `admin@dua.test`, `acceptance@dua.test`, `kitchen@dua.test`, `driver@dua.test`, and equivalent `@flat.test` accounts. Public local password: `synthetic-local-staff-2026`. Do not save these disposable credentials in a password manager or use them outside this proof.

## Observed behavior

Real PostgreSQL tests prove legacy history/flat-price/default-delivery preservation through migration six; SQL price/money/quantity constraints; flat and required authoritative pricing; required selection enforcement; mixed line totals/snapshots; delivery fee/contact/driver progression; addressless zero-fee pickup and driver exclusion; token tracking/cancellation; immutable history after catalog changes; standalone edit version invalidation; concurrent aggregate winner/409 loser; order versus variant repricing; referenced variant archiving and last-variant refusal; sold-out required saves. PostgreSQL credentials and HTTP/socket tokens from the other runtime are rejected. Each runtime accepts only its own configured CORS origin.

Hub tests preserve created/updated/removed reconciliation, reconnect refresh, stale/late HTTP and mutation success/failure handling, duplicate-action protection, Kitchen gestures/keyboard/modes and browser-local preferences. New real component tests render historical mixed flat/required snapshots in Kitchen and Archive. Locale and business timezone are separate; DST/browser-zone regressions retain UTC instant identity. Archive presets retain rolling 24-hour duration semantics, with epoch all-time coverage; date-only API bounds use business-day boundaries.

Browser rehearsal used only 1440/768/390 pixel widths for both configurations: login/landing redirects, Acceptance, Kitchen, Deliveries, Staff, Menu, Settings and Archive loaded; document width matched viewport at all measured pages. Kitchen desktop columns and tablet/mobile stage scrolling remain intact. Required sizes appear alongside flat lines; pickup is absent from Deliveries. Flat create/reprice saved, all-unavailable required edit saved, and Archive displayed immutable original names/prices after catalog rename/archive. Both is the default; Buttons only persisted after reload; Quick tap changed a ticket; switching restored Both. API disconnection displayed a stale banner without hiding loaded tickets; failed Retry retained tickets; restart/reconnect recovered.

## Scope and remaining limitations

Keep everything local. No push, merge, deployment, provider change, production query or destructive Le Sandwich seed was performed. Existing dirty canonical checkouts, protected DUA worktrees and storefronts remain outside this change.

Hub lint has seven existing Fast Refresh warnings and zero errors. Dependency advisories are reported in the owner handoff; broad dependency upgrades were intentionally not folded into the shared-core architecture change. Browser evidence is a local Chrome rehearsal, not a production/load/device certification. Future Le Sandwich deployment/data adaptation remains a separate phase.
