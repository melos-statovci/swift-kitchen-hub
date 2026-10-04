# Shared SwiftKitchen Core

Approved scope: 4 October 2026. This phase builds reusable operational source from the protected DUA baselines. Existing Le Sandwich hosting, production data and dirty legacy work are outside scope; future adaptation is a separate phase.

## Source and isolation

Keep one Hub repository and one backend repository. A release is a Hub commit and a backend commit, each deployed independently per restaurant. Each backend runtime connects to exactly one restaurant database, with separate database credentials, JWT secret, CORS origins and environment configuration. There are no tenants, organization IDs, restaurant IDs in request handling, shared restaurant databases or runtime database switching.

Protected references: Hub `1a4ddd46945371bea76060cf8fa527d1705c8f92`; backend `e6b603b07d37ab1061738aa050b3fad914beac0e`. Preserve Direction A, role authorization and operational workflow.

## Configuration authority

Build/runtime configuration: restaurant display name, currency, display locale, business timezone, API URL, CORS origins, JWT secret, DATABASE_URL, DIRECT_URL and APP_ENV. Both database URLs must target the same restaurant database; production credentials never enter browser variables.

Database-local authority: catalog, staff, orders/customer information, opening hours, pause state and delivery fee. Each database has its own singleton RestaurantSettings row.

Browser-local authority: Kitchen interaction mode and operator sound preferences. Keep Quick tap, Buttons only and Both; missing/invalid storage defaults to Both. Do not persist these preferences on the backend.

## Products, money and history

Keep MenuItem, MenuItemVariant and variantMode NONE/REQUIRED. NONE requires a real integer-cent MenuItem.price and orders with variantId null. REQUIRED requires MenuItem.price null and at least one nonarchived priced variant; the selected variant must belong to the product and be available/nonarchived when ordered. All variants may be unavailable, making the product unavailable to public ordering. Never manufacture Default/Standard/Normal variants or branch on restaurant identity.

The backend calculates authoritative unit prices and totals in a transaction. Client pricing fields are rejected. Preserve nameSnapshot, priceSnapshot, variantId, variantNameSnapshot and variantPriceSnapshot. Catalog renames, repricing and archiving never rewrite historical order snapshots; referenced records remain archived rather than destructively removed.

Aggregate menu editing remains the primary editor contract. Standalone parent creation cannot publish a REQUIRED parent without variants; use aggregate creation. Every standalone variant write locks the parent first, validates the resulting state, and advances the parent's edit version. Removing the last nonarchived REQUIRED variant is rejected. Flat-mode transitions retain historical variants but require an explicit flat price.

## Fulfillment and operational state

Keep DELIVERY/PICKUP and the existing eight status values. Delivery requires address/contact and uses the configured delivery fee; pickup does not require an address, charges zero delivery fee and never appears in driver lists, actions or realtime payloads. Retain legacy flat checkout using menuItemId/quantity/notes, delivery as the omitted fulfillment default, and token tracking/cancellation contracts.

## Realtime and time display

Retain created/updated/removed events, role-scoped server payloads, reconnect refresh, stale/empty/loading distinction, duplicate-action guards and protection from late HTTP success/failure/refresh replacing newer realtime state. Preserve Kitchen gesture and keyboard behavior.

Stored timestamps remain UTC instants. Business-facing clock/date display and business-day filtering use the configured IANA business timezone; display locale controls formatting only. Never reinterpret a UTC instant as a local timestamp. Unfinished analytics is outside scope.

## Local proof and safety

Use the same source with two separate disposable PostgreSQL databases: DUA-style variants plus flat products, and a synthetic flat-only restaurant. Guard seed/reset/local migration tooling before opening database connections. Require an explicit local acknowledgement and exact allowed loopback database/port identities; check DATABASE_URL and DIRECT_URL and reject connection overrides, unknown targets and production environments. Never execute destructive Le Sandwich seeds.

Preserve existing regression suites and add real PostgreSQL tests for migration preservation, pricing races and menu conflict detection. Verify both local configurations and Hub at 1440/768/390 pixels. No storefront consolidation, deployment, push, main merge or protected-worktree edits in this milestone.
