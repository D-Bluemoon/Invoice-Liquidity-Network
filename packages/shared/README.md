# `@iln/shared`

Shared ILN domain types for packages that need a single source of truth.

## Install

```bash
npm install @iln/shared
```

## Usage

```ts
import type { Invoice, ContractStats } from "@iln/shared";
```

## Type tests

Every exported type has type-level assertions in `test-d/`, written with
[tsd](https://github.com/tsdjs/tsd): valid usage must type-check, invalid usage
must produce a type error, and the unions must narrow the way consumers rely on.

```bash
pnpm --filter @iln/shared test
```

That compiles `src/` with `tsc` and then runs `tsd` against the emitted
declarations, which is what `@iln/shared` actually publishes. It runs in CI as
the required `CI / Shared package type tests` check — see
[docs/branch-protection.md](../../docs/branch-protection.md).

This package is a dependency of `sdk`, `cli`, `indexer`, and `notifications`, so
a change here that breaks a consumer's type-checking will not necessarily fail
any runtime test. Add or update the assertions in `test-d/` in the same PR as
any change to `src/types.ts` or `src/index.ts`.
