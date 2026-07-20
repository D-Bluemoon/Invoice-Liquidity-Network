# `@iln/sdk` vs `@iln/sdk-next`

The repo currently ships two parallel TypeScript SDK packages:

| | `sdk/` (`@iln/sdk`) | `packages/sdk` (`@iln/sdk-next`) |
|---|---|---|
| Status | **Stable — recommended for all integrators** | Experimental — modular/browser-first rewrite, not yet feature-complete |
| `@stellar/stellar-sdk` | `^15.0.1` | `^12.0.0` |
| Module format | ESM + CJS, single entry point | ESM + CJS + dedicated `browser` build, submodule exports (`./tokens`, `./events`, `./errors`, `./xdr`) |
| Browser support | Freighter signing via peer deps | Dedicated `vite.browser.config.ts` build and Playwright browser test suite (`tests/browser/`) — `sdk/` has neither |
| React / React Native | `CheckoutWidget.tsx`, `InvoiceDashboard.tsx`, `react-native/` entry point | None yet |
| Governance | `governance.ts`, `governance-parser.ts`, `governance-utils.ts`, `governance-types.ts` | None yet |
| Analytics / offline / plugins | `analytics.ts`, `offline.ts`, `plugins.ts`, `recovery.ts`, `federation.ts` | None yet |
| Test runner | Vitest | Jest (unit) + Playwright (browser) |

## Decision: `@iln/sdk` is the stable package today

`sdk/` (`@iln/sdk`) is what `docs/sdk-quickstart.md` installs and what
integrators should build against right now. It has the full feature set —
governance, analytics, offline support, plugins, React and React Native
bindings — none of which exist yet in `packages/sdk`.

`packages/sdk` (`@iln/sdk-next`) is where the SDK is being rebuilt with a
leaner, more modular API surface (per-feature submodule exports) and a
first-class browser build/test pipeline. It is not a drop-in replacement:
it is missing governance, analytics, offline, plugins, and React support
present in `@iln/sdk`.

## What's new in `-next`

- **Modular exports** — `@iln/sdk-next/tokens`, `/events`, `/errors`, `/xdr`
  can be imported independently instead of pulling in the full SDK.
- **First-class browser build** — a dedicated `browser` export condition
  (`dist/browser/index.js`) built with Vite, plus a Playwright suite that
  runs the SDK in a real browser instead of relying on peer-dependency
  shims.
- **`crypto-browser.ts`** — uses the Web Crypto API instead of Node's
  `crypto` module for browser environments.

## What's deprecated in `@iln/sdk`

Nothing in `@iln/sdk` is deprecated yet. `@iln/sdk-next` has not reached
feature parity, so no migration should happen until it does.

## Target timeline

No firm deprecation date is set. `@iln/sdk-next` needs governance,
analytics, offline, plugins, and React/React Native support before it can
be considered a replacement candidate. Once parity is reached, this doc
will be updated with a deprecation timeline for `@iln/sdk` and a step-by-step
migration guide (in the style of `docs/sdk-migration-guide.md`).

## For contributors

- Building an integration today → install `@iln/sdk`, follow
  `docs/sdk-quickstart.md`.
- Working on the next-generation modular/browser SDK → `packages/sdk`
  (`@iln/sdk-next`).
- New feature work should land in `@iln/sdk` until `@iln/sdk-next` reaches
  parity; browser-specific or modular-export work belongs in
  `@iln/sdk-next`.
