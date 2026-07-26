# Contributing to Invoice Liquidity Network

Thank you for your interest in contributing. Invoice Liquidity Network (ILN) is a multi-repository project. This guide explains how the three-repo structure works, where to open issues, how PRs are reviewed, how decisions are made, and how the Drips Wave model works.

---

## Project structure

- [Ways to contribute](#ways-to-contribute)
- [Applying to work on an issue](#applying-to-work-on-an-issue)
- [Project board](#project-board)
- [Development setup](#development-setup)
- [CI/CD pipeline reference](#cicd-pipeline-reference)
- [Submitting a pull request](#submitting-a-pull-request)
- [Branch protection](#branch-protection)
- [Code standards](#code-standards)
- [Automated dependency updates](#automated-dependency-updates)
- [Getting help](#getting-help)
| Repository | Purpose | Typical contributions |
|------------|---------|-----------------------|
| `Invoice-Liquidity-Network` | Project-level repo: shared docs, SDK, CLI, indexer, notifications, repo tooling, developer guides | SDK, CLI, docs, indexer improvements, notifications, repo workflows, shared tests |
| `ILN-Frontend` | Frontend dApp: freelancer dashboard, LP analytics, governance UI, visual polish | UI, UX, styles, React components, frontend integration |
| `ILN-Smart-Contract` | Soroban / Rust smart contracts, on-chain invoice lifecycle, contract tests | contract logic, on-chain validations, Rust tests, protocol security |

This document is the entry point for first-time contributors and for anyone who wants to work across repos.

---

## Where to contribute

Start by choosing the right repo for the issue or improvement.

- **Bug in contract behavior or on-chain logic** → `ILN-Smart-Contract`
- **Visual issue, layout bug, or frontend flow problem** → `ILN-Frontend`
- **SDK, CLI, docs, indexer, notifications, or shared repository tooling** → `Invoice-Liquidity-Network`
- **Governance process, roadmap, coordination, or project-level policy** → `Invoice-Liquidity-Network`
| Label              | Meaning                            |
| ------------------ | ---------------------------------- |
| `help wanted`      | High priority, no funding attached |
| `good first issue` | Well-scoped, good entry point      |
| `in progress`      | Already claimed, do not apply      |

If you are unsure or the work spans multiple repos, open the issue in `Invoice-Liquidity-Network` and clearly explain the affected repo(s). Maintainers will help route it.

---

## Drips Wave contribution model

The Drips Wave system is our project prioritization and complexity model. Every issue is assigned a Wave point value during triage.

### How points are assigned

- `1 point` — small docs updates, typo fixes, minor test cleanups
- `2 points` — small bug fixes, minor frontend polish, SDK/CLI small improvements
- `3 points` — medium bug fixes, new helper behavior, contract interface updates, documentation with code changes
- `4 points` — new feature in one repo, significant UX flow changes, contract + SDK coordination
- `5+ points` — large cross-repo work, major architecture changes, governance or protocol enhancements

Maintainers assign points during issue triage and use them to group work into Waves. If you are new, ask for “Drips Wave points” in the issue comment and maintainers will assign the appropriate complexity level.

### Why it matters

- It helps contributors choose work at the right size
- It makes review and planning easier
- It keeps PRs focused and aligned with project priorities

When you open or apply to work on an issue, include the Wave points if available.

---

## Getting started (first-time contributor)

### Prerequisites

- Node.js 18+
- `pnpm` 9+
- Rust 1.74+
- Docker
- Stellar CLI

### Clone the project with submodules

```bash
git clone --recurse-submodules https://github.com/Invoice-Liquidity-Network/Invoice-Liquidity-Network.git
cd Invoice-Liquidity-Network
git submodule update --init --recursive
pnpm install
```

### Package manager policy

This repository is a single **pnpm workspace** (see `pnpm-workspace.yaml`). The
root `pnpm-lock.yaml` is the only lockfile that should ever exist in this repo.

- Always use `pnpm install` / `pnpm add` — never `npm install` or `yarn add`,
  even inside an individual package such as `cli/`, `sdk/`, or `indexer/`.
  Running npm or yarn there will generate a stray `package-lock.json` or
  `yarn.lock` that can silently diverge from what CI resolves via pnpm.
- CI runs `pnpm run validate:lockfiles` (`scripts/check-no-foreign-lockfiles.mjs`)
  on every PR and fails the build if any `package-lock.json` or `yarn.lock`
  is found anywhere in the repo. If you hit this, delete the stray lockfile
  and re-run `pnpm install` from the repo root.
- CI runs `pnpm syncpack:check` on every PR to enforce consistent dependency version ranges across all workspaces. This ensures we avoid dependency version drift. If this check fails, run `pnpm syncpack:fix` locally to align versions.

### Start local development

- Use `README.md` and `docs/local-development.md` in this repo for the root development setup.
- The frontend and smart contract repositories each have their own setup instructions once their submodules are initialized.
- Run the root test suite with:

```bash
pnpm test
```

### Local repo basics

- `sdk/` — TypeScript SDK and client helpers
- `cli/` — command-line interface for contract interactions
- `indexer/` — event indexer service for frontend data
- `notifications/` — webhook notification service
- `docs/` — shared documentation and contribution guides

### Formatting

This repository uses a shared root Prettier configuration to keep formatting consistent across packages.

- Run `pnpm format` to apply formatting.
- Run `pnpm format:check` to verify formatting without changing files.
- Generated outputs and Markdown files are excluded by the root `.prettierignore`.

### Test conventions

Tests are colocated with source files in `src/` using the `*.test.ts` naming convention. All SDK tests live in `sdk/src/` alongside the modules they test.

- Write tests in the same directory as the source file: `sdk/src/client.test.ts` tests `sdk/src/client.ts`.
- Run the SDK test suite with `pnpm test` from the `sdk/` directory.
- Integration tests against testnet: `pnpm test:integration` and `pnpm test:integration:testnet`.
- E2E tests against a local Stellar node: `pnpm test:e2e-local`.
- The `sdk/vitest.config.ts` test-match glob covers `src/**/*.test.ts` only.

### Bundle-size budgets

The `@iln/sdk` bundle size is checked in CI via `scripts/check-bundle-size.js` and the `sdk-bundle-size.yml` workflow. Size limits are defined in `sdk/.bundle-size.json`.

If your change intentionally increases the bundle size (e.g. adding a new feature):
1. Update the limit values in `sdk/.bundle-size.json`.
2. Explain the size increase in your PR description.

### i18n / internationalisation

A `sdk/locales/` directory was removed in #694 after an audit confirmed it was not wired into the built SDK. If SDK-level string localisation is prioritised in the future, file an RFC in `Invoice-Liquidity-Network` to design the locale-loading mechanism before adding translation files.

---

## Issue process

1. Search open issues in the appropriate repo.
2. If you find an existing issue, comment with your interest and proposed approach.
3. If you do not find an issue, open a new one in the most relevant repo using the decision tree above.
4. In your issue comment, include:
   - what you plan to build
   - why the change is needed
   - any relevant experience or prior work
   - an estimated timeline
5. Wait for maintainers to assign the issue and add labels.

### Issue labels

Common labels include:

- `help wanted` — good opportunity for contributors
- `good first issue` — ideal for newcomers
- `in progress` — claimed by a contributor
- `bug` — defect in functionality
- `enhancement` — new feature or improvement
- `design` — architecture or UX proposal

---

## CI/CD pipeline reference

The repository's GitHub Actions workflows are documented in [docs/ci-cd.md](./docs/ci-cd.md). That reference explains what each workflow does, what secrets it needs, how long it usually takes, and how to debug failures.

Use it before pushing changes so you can match the relevant CI checks locally.

### Pinning third-party actions

When you add or edit a GitHub Actions workflow, pin every **third-party** action (anything
not under `actions/*`) to a full commit SHA with a version comment:

```yaml
# Do this
- uses: dorny/paths-filter@d1c1ffe0248fe513906c8e24db8ea791d46f8590 # v3.0.3

# Not this
- uses: dorny/paths-filter@v3
```

Resolve a tag to its SHA with `git ls-remote https://github.com/<owner>/<repo> refs/tags/<tag>`.
First-party `actions/*` actions may stay on major-version tags. Renovate
(`renovate.json`, `pinDigests: true`) keeps the SHAs and comments up to date automatically,
so let it open the bump PRs rather than editing SHAs by hand. A couple of actions read their
behaviour from the ref name — pin them to a SHA **and** pass the choice as an input
(`dtolnay/rust-toolchain` → `toolchain: stable`, `taiki-e/install-action` → `tool: <name>`).
The full policy and current pin table live in
[docs/ci-cd.md](./docs/ci-cd.md#pinned-action-versions-supply-chain).

### Cross-platform CLI install smoke test

The `cli-smoke.yml` workflow runs on a `ubuntu-latest` / `macos-latest` / `windows-latest`
matrix. On each OS it builds the CLI (`@iln/cli`), packs it together with its unpublished
workspace dependencies (`@iln/sdk`, `@iln/shared`), installs the tarballs **globally** in a
clean environment, and runs `iln --version` and `iln --help`. This catches
platform-specific packaging breakage (shebang handling, path separators, an internal
`workspace:*` dependency leaking into the published artifact) before a release.

Because the internal packages are not published to npm, a plain `npm pack` +
`npm install -g` of the CLI alone will fail to resolve `@iln/sdk`. Pack the whole internal
graph and install the tarballs in one command so npm resolves the `@iln/*` versions from the
sibling tarballs.

**Manual fallback** — reproduce the smoke test locally on any OS if CI is unavailable or you
want to debug a failure:

```bash
# From the repo root, after `pnpm install --frozen-lockfile`
pnpm --filter "@iln/cli..." build

# Pack the CLI and its unpublished workspace deps into one directory
mkdir -p /tmp/iln-tarballs
( cd packages/shared && pnpm pack --pack-destination /tmp/iln-tarballs )
( cd sdk            && pnpm pack --pack-destination /tmp/iln-tarballs )
( cd packages/cli   && pnpm pack --pack-destination /tmp/iln-tarballs )

# Install all three tarballs together so the @iln/* deps resolve locally
npm install -g /tmp/iln-tarballs/*.tgz

# Smoke test
iln --version   # expect a semver, e.g. 0.1.0
iln --help      # expect the "Invoice Liquidity Network CLI" description

# Clean up
npm uninstall -g @iln/cli @iln/sdk @iln/shared
```

On Windows, run the same commands from **Git Bash** (bundled with Git for Windows) so the
`( cd ... )` subshells and the `*.tgz` glob behave the same as on macOS/Linux; PowerShell
expands globs differently. If `iln` is not found after install, confirm the npm global bin
directory (`npm prefix -g`) is on your `PATH`.

---

## Changeset workflow

Any PR that touches `packages/**` or `sdk/**` must include a [changeset](https://github.com/changesets/changesets),
enforced by [`changeset-check.yml`](./.github/workflows/changeset-check.yml). Add one with:

```bash
pnpm changeset
```

Follow the prompts to pick the changed package(s) and a semver bump, then commit the generated
`.changeset/*.md` file alongside your change.

### Shared-dependency changes need extra care

`packages/shared` (`@iln/shared`) is a foundational dependency: `sdk` depends on it directly, and
`cli`, `packages/cli`, `packages/invoice-sdk`, `packages/react`, and `packages/opentelemetry` all
depend on `sdk` in turn. A change to `packages/shared` can therefore require a version bump in any
of those downstream packages too, not just in `packages/shared` itself.

`changeset-check.yml` runs [`scripts/check-changeset-dependents.mjs`](./scripts/check-changeset-dependents.mjs)
on every PR to flag this: it walks the internal (`@iln/*`) dependency graph, finds every workspace
package that transitively depends on something you changed, and lists any that aren't covered by a
changeset yet. This is advisory, not a hard failure — use it as a reviewer checklist item and decide
per-PR whether a listed dependent actually needs its own changeset entry.

Once a changeset does target a dependent, `@changesets/cli` (`updateInternalDependencies: "patch"`
in [`.changeset/config.json`](./.changeset/config.json)) automatically adds a patch bump for any
other workspace package that declares that dependent as an internal dependency when versions are
cut — you do not need to hand-write those follow-on bumps.

---

## Releasing the SDK

The `@iln/sdk` package (`packages/sdk`) is published to npm automatically by the
[`sdk-release.yml`](./.github/workflows/sdk-release.yml) workflow. Releases are
**tag-driven** and reproducible — no one publishes from a laptop.

**Before tagging**

1. Land the changes you want to release on `main`.
2. Add the new version's entry to the top of [`CHANGELOG.md`](./CHANGELOG.md)
   using the `## [x.y.z] - YYYY-MM-DD` heading format. The release workflow
   copies this section verbatim into the GitHub Release notes.
3. Bump `version` in `packages/sdk/package.json` to match.

**Cutting the release**

```bash
git tag v1.2.3        # tag must start with "v" and match the package version
git push origin v1.2.3
```

Pushing a `v*` tag triggers the workflow, which will:

- install, build, and test the SDK;
- publish to npm with **build provenance** (`--provenance`) for supply-chain
  transparency, authenticated via the `NPM_TOKEN` repository secret;
- create a GitHub Release whose body is the changelog section for that version.

**Dry runs.** Every pull request that touches `packages/sdk/**` runs the same
build and a `pnpm pack` dry run (no publish), so packaging regressions are
caught before a tag is ever cut.

**Required secret.** `NPM_TOKEN` — an npm automation token with publish rights
to the `@iln` scope. Provenance additionally relies on the workflow's
`id-token: write` permission, which is already configured.

---

## Submitting a pull request

### Conventional Commits and PR Titles

We enforce [Conventional Commits](https://www.conventionalcommits.org/) across the project using `commitlint` (configured in `commitlint.config.js`). This standardizes our changelog generation and commit history. 

There are two enforcement mechanisms that share this configuration:
1. **Local Commits:** A Husky `commit-msg` hook lints individual commit messages locally to catch issues early during development.
2. **PR Titles:** A GitHub Actions workflow (`pr-title-lint.yml`) lints the PR title. This ensures that when a PR is squash-merged, the resulting single commit on `main` follows the convention, maintaining a clean project history.

### Pull request process

1. Fork the repository.
2. Create a branch named for the scope of the work:
   - `fix/...`, `feat/...`, `docs/...`, `chore/...`
3. Make focused changes with clear conventional commit messages.
4. Run the relevant tests and verify the change locally.
5. Open a PR against `main`.
6. In the PR description, include:
   - what changed
   - why it changed
   - how to test it
   - related issue reference (`Closes #...`)

### PR checklist

- [ ] Branch is based on current `main`
- [ ] Tests pass locally
- [ ] New behavior includes test coverage
- [ ] Documentation is updated where needed
- [ ] Code is easy to review and scoped to one purpose
- [ ] The PR references the relevant issue or discussion

### Cross-repo contributions

If the work touches more than one repo, mention the affected repos clearly in the issue and PRs. Maintain separate PRs for each repo unless instructed otherwise by a maintainer.

---

## Code review expectations

- Keep PRs small and focused.
- Explain your changes clearly in the PR description.
- Add tests for bug fixes and new behavior.
- Update docs when public interfaces or workflows change.
- Run the repository-specific test suite before requesting review.
- Respond to review feedback in a timely manner.
- Be open to suggestions and improve the implementation iteratively.

### Review timeline

Maintainers aim to review contributions within 48 hours. Larger or cross-repo work may take longer.

---

## Decision making

Project decisions are made through issue discussion, design proposals, and maintainer review.

- Small changes: approved by maintainers after issue/PR discussion.
- Larger technical changes: require a design issue or RFC-style proposal first.
- Cross-repo coordination: handled in the root repository and tracked through issue comments.

When in doubt, ask in the issue or open a discussion to confirm the recommended approach.

### Secret scanning and false positives

This repository enforces secret scanning locally before each commit.

- A Husky `pre-commit` hook runs `gitleaks` against the repository.
- The scan is configured in `gitleaks.toml` and includes ILN-specific rules for Stellar secret seeds, Ethereum private keys, AWS credentials, and generic API tokens.
- Existing findings are recorded in `.secrets.baseline`; new commits must not introduce additional findings.

If you encounter a false positive:

1. Confirm the value is not an actual secret.
2. If the finding is valid and should remain in the baseline, regenerate the baseline with:

```bash
pnpm run gitleaks:baseline
```

3. If the finding is not relevant and should be ignored permanently, add a specific allowlist entry to `gitleaks.toml` rather than disabling scanning globally.

4. Document any baseline or allowlist updates in your PR so reviewers can verify the change.

### Security and Trust Models

Before contributing to the SDK or making changes to transaction signing behavior, review the [SDK Trust Model](./docs/sdk-trust-model.md). This document explains the assumptions and validation boundaries for operations.


---

## Getting help

- **GitHub Discussions** — for questions, ideas, and early proposals
- **Issues** — for bug reports, feature requests, and task planning
- **Discord** — community chat and support (invite link pending)

If you are new to Soroban development, start with the [Stellar Developer Docs](https://developers.stellar.org/docs/build/smart-contracts/overview) and the [Soroban examples repo](https://github.com/stellar/soroban-examples).

---

## Code of Conduct

This project follows the [Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/) Code of Conduct. By contributing, you agree to uphold the standards in that policy.

---

## Responsible disclosure

If you discover a security vulnerability in the smart contract or any part of ILN, please **do not open a public issue**.

Email us at `margretnursca@gmail.com` or open a GitHub Security Advisory.

Please include:

- a description of the vulnerability
- steps to reproduce
- your assessment of impact
- any suggested fix

We will acknowledge your report within 48 hours.
