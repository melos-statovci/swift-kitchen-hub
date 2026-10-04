# Shared SwiftKitchen Hub

See the [architecture spec](docs/superpowers/specs/2026-10-04-shared-core-design.md), [local review instructions](docs/local-review.md) and [verification evidence](docs/verification.md).

This worktree serves the same operational source with two independent deployment configurations. Start the matching local backend proof first, then copy the shared environment examples and run Vite on port 8083 (shared-variant) or 8084 (shared-flat). Synthetic login details and repeatable commands are in the local review instructions.

```sh
npm test
npm run typecheck
npm run lint
npm run format:check
npm run build
```

No source-specific restaurant behavior or tenancy is introduced. Runtime settings/catalog/staff/orders belong to each independent backend database; Kitchen controls and sound preferences remain browser-local.
