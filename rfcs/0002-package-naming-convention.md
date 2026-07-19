# RFC 0002 — Package Naming Convention

- **Status:** Draft
- **Author(s):** [@Wilfred007](https://github.com/Wilfred007)
- **Created:** 2026-07-19
- **PR:** (pending)

---

## Summary

Standardise all workspace package names under the `@iln/*` npm scope. Three
current conventions — `@iln/*`, `@invoice-liquidity/*`, and unscoped `iln-*`
names — will be consolidated into a single predictable pattern so that every
package can be imported as `@iln/<name>`.

---

## Motivation

The workspace currently mixes three naming conventions:

| Convention | Example | Count |
|---|---|---|
| `@iln/*` | `@iln/sdk` | 16 packages |
| `@invoice-liquidity/*` | `@invoice-liquidity/cli` | 3 packages |
| Unscoped / `iln-*` | `iln-indexer` | 8 packages |

This inconsistency creates real friction:

- Contributors cannot predict a package's import name from its directory.
- The root `package.json` already uses `@iln` for the `@iln/sdk` publish
  scope, but other packages contradict it.
- A future npm publishing strategy (publishing CLI, React bindings, etc.)
  needs a single registered scope.
- Dependency resolution is harder to reason about when names are split
  across three conventions.
