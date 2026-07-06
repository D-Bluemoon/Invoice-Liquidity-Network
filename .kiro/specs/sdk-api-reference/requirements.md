# Requirements Document

## Introduction

This feature automates the generation and publishing of an API reference for the `@iln/sdk` package. TypeDoc reads JSDoc comments and TypeScript type information from `packages/sdk/src/`, converts them to MDX pages, and places the output under `packages/docs/content/sdk-reference/`. A CI job regenerates the reference on every change to the SDK and wires the output into the existing Nextra-based docs site navigation. Every generated page carries a "Generated on [date] from SDK v[version]" footer so readers always know which SDK version the reference describes.

## Glossary

- **TypeDoc**: Open-source documentation generator for TypeScript that reads JSDoc annotations and emits structured output.
- **MDX_Generator**: The TypeDoc MDX plugin (or equivalent script) responsible for converting TypeDoc JSON output into `.mdx` files.
- **SDK**: The `@iln/sdk` package located at `packages/sdk/src/`.
- **Docs_Site**: The Next.js / Nextra documentation site located at `packages/docs/`.
- **Reference_Output_Dir**: The directory `packages/docs/content/sdk-reference/` where generated MDX pages are written.
- **CI_Pipeline**: The GitHub Actions workflow that runs on SDK file changes.
- **Public_Symbol**: Any exported TypeScript identifier (class, method, function, type alias, interface, or enum) that appears in the package's public entry point (`packages/sdk/src/index.ts`).
- **Version_Footer**: A standardised text block appended to every generated page with the format "Generated on [ISO date] from SDK v[semver]".
- **Nav_Config**: The Nextra `_meta.ts` file inside `packages/docs/content/sdk-reference/` that controls page ordering and sidebar labels.

---

## Requirements

### Requirement 1: TypeDoc Configuration

**User Story:** As a developer, I want TypeDoc configured specifically for the SDK package, so that only public symbols are processed and the output format matches the docs site expectations.

#### Acceptance Criteria

1. THE SDK SHALL include a `typedoc.json` configuration file at `packages/sdk/typedoc.json` that specifies `packages/sdk/src/index.ts` as the sole entry point.
2. THE TypeDoc configuration SHALL set `entryPointStrategy` to `"resolve"` so only explicitly exported symbols are included.
3. THE TypeDoc configuration SHALL exclude private and internal symbols by setting `excludePrivate` and `excludeInternal` to `true`.
4. THE TypeDoc configuration SHALL set the `out` field to `../../packages/docs/content/sdk-reference/generated` (relative to `packages/sdk/`) as the output directory.
5. WHERE the `typedoc-plugin-markdown` plugin is listed as a dependency of `packages/sdk`, THE TypeDoc configuration SHALL include `"plugin": ["typedoc-plugin-markdown"]` and set `"fileExtension": ".mdx"` to produce MDX-compatible output files.
6. THE `packages/sdk/package.json` SHALL include a `"docs:generate"` script with the value `"typedoc --options typedoc.json"` that can be executed via `pnpm --filter @iln/sdk docs:generate`.
7. WHEN `typedoc --options typedoc.json` is executed and the configuration file is absent or malformed, THE process SHALL exit with a non-zero status code and print the missing or invalid field name to standard error.

---

### Requirement 2: MDX Output Structure

**User Story:** As a documentation reader, I want the generated reference pages to follow a consistent MDX structure, so that they render correctly in the Nextra docs site without manual editing.

#### Acceptance Criteria

1. WHEN TypeDoc runs against `packages/sdk/src/index.ts`, THE MDX_Generator SHALL produce one MDX file per non-empty Public_Symbol category (classes, interfaces, enumerations, type aliases, functions); categories with zero exported symbols SHALL be omitted from the output.
2. THE MDX_Generator SHALL emit files that pass MDX 2 parsing (i.e., `@mdx-js/mdx` compiles them without throwing a parse error) so that the Docs_Site can import and render every generated file without build errors.
3. WHEN a Public_Symbol has no JSDoc `@param` or `@returns` tag, THE MDX_Generator SHALL still emit at minimum the symbol's full TypeScript signature (name, parameter list with types, and return type) and its category heading.
4. THE MDX_Generator SHALL NOT write to any path outside `packages/docs/content/sdk-reference/generated/`; any attempt to resolve an output path outside this directory SHALL cause the process to exit with a non-zero status and an error message identifying the conflicting path.
5. WHEN generation completes, THE MDX_Generator SHALL write or update `packages/docs/content/sdk-reference/generated/_meta.ts` so that it exports a default object containing one key per generated MDX file (keyed by filename without extension) and a string label as the value, enabling Nextra to register them in the sidebar.

---

### Requirement 3: Version Footer

**User Story:** As a documentation reader, I want every generated reference page to show when it was generated and from which SDK version, so that I can tell whether the docs match the SDK I am using.

#### Acceptance Criteria

1. THE MDX_Generator SHALL append a Version_Footer as the last element of every generated MDX page, after all symbol documentation content.
2. THE Version_Footer SHALL match the exact format: `Generated on YYYY-MM-DD from SDK v{semver}`, where `YYYY-MM-DD` is the UTC calendar date at generation time and `{semver}` is the `version` field read from `packages/sdk/package.json`.
3. IF `packages/sdk/package.json` does not exist or cannot be read, THEN THE MDX_Generator SHALL exit with a non-zero status code and an error message that includes the expected file path and the I/O error encountered.
4. IF the `version` field in `packages/sdk/package.json` is absent or is not a valid semver string (i.e., does not satisfy the `semver.valid()` check), THEN THE MDX_Generator SHALL exit with a non-zero status code and an error message that includes the invalid value and the expected semver format.

---

### Requirement 4: JSDoc Coverage Enforcement

**User Story:** As a maintainer, I want CI to fail when public SDK symbols lack JSDoc documentation, so that the published reference is never incomplete.

#### Acceptance Criteria

1. WHEN the `docs:generate` script runs, THE MDX_Generator SHALL verify that every Public_Symbol has a JSDoc description containing at least one non-whitespace character of prose text (an empty `/** */` or whitespace-only comment does not satisfy this requirement).
2. IF one or more Public_Symbols are missing a qualifying JSDoc description, THEN THE MDX_Generator SHALL exit with a non-zero status code and print to standard output the name and source file location of each undocumented symbol before writing any output files.
3. IF any Public_Symbol — including exported functions — is missing a qualifying JSDoc description when `docs:generate` is invoked, THEN THE MDX_Generator SHALL abort before producing any MDX output and SHALL print the full list of undocumented symbol names (covering classes, methods, type aliases, interfaces, enums, and functions) to standard output.

---

### Requirement 5: CI Automation

**User Story:** As a maintainer, I want the API reference to regenerate automatically in CI whenever the SDK source changes, so that the published docs always reflect the latest SDK code.

#### Acceptance Criteria

1. WHEN a push or pull-request event occurs and at least one changed file matches `packages/sdk/src/**`, THE CI_Pipeline SHALL trigger a dedicated job named `sdk-api-docs`.
2. WHEN the `sdk-api-docs` job runs, THE CI_Pipeline SHALL restore the pnpm dependency cache and then execute `pnpm --filter @iln/sdk docs:generate`.
3. WHEN the `sdk-api-docs` job completes successfully on a branch build, THE CI_Pipeline SHALL stage all files under `packages/docs/content/sdk-reference/generated/`, create a commit authored by `github-actions[bot]`, and push it to the branch being built so that the existing docs deployment workflow can pick up the changes.
4. IF the `sdk-api-docs` job fails on a pull-request event, THEN THE CI_Pipeline SHALL post a pull-request comment that identifies the job failure and reproduces the list of undocumented symbols printed to standard output by the generation script; IF the failure occurs on a push event (not a pull request), THEN THE CI_Pipeline SHALL write the same information to the job summary log instead.
5. THE CI_Pipeline `sdk-api-docs` job SHALL declare `needs: [pnpm-cache]` so that dependency installation is cache-backed before the generation step runs.

---

### Requirement 6: Docs Site Navigation Integration

**User Story:** As a documentation reader, I want the generated SDK reference pages to appear in the docs site sidebar under an "SDK Reference" section, so that I can navigate them without knowing their file paths.

#### Acceptance Criteria

1. WHEN the Docs_Site builds, THE Docs_Site SHALL include all pages listed in `packages/docs/content/sdk-reference/generated/_meta.ts` in its sidebar under the "SDK Reference" section, verified by the absence of Next.js "missing page" warnings for those entries.
2. WHEN a new non-empty Public_Symbol category is added to the SDK and generation runs, THE Nav_Config (`generated/_meta.ts`) SHALL contain a new key for that category's MDX file so the page appears in the sidebar without any manual file edits.
3. THE Nav_Config for the top-level `sdk-reference` section SHALL list hand-authored page keys (`installation`, `api-reference`) before any keys imported or re-exported from `generated/_meta.ts`, enforcing that hand-authored pages appear first in sidebar order.
4. WHEN the Docs_Site build runs after generation, all anchor links within the `packages/docs/content/sdk-reference/generated/` subdirectory that point to other pages within that same subdirectory SHALL resolve without producing Next.js build warnings or errors.
5. IF `packages/docs/content/sdk-reference/generated/_meta.ts` is absent when the Docs_Site build runs, THEN the Docs_Site build SHALL exit with a non-zero status and an error message identifying the missing file.

---

### Requirement 7: Local Developer Workflow

**User Story:** As a developer contributing to the SDK, I want to preview regenerated docs locally before pushing, so that I can validate my JSDoc changes without waiting for CI.

#### Acceptance Criteria

1. THE `packages/sdk/package.json` SHALL expose a `"docs:preview"` script that sequentially runs `docs:generate` and, upon its successful completion, starts the Docs_Site development server bound to `localhost:3000`.
2. WHEN a developer runs `pnpm --filter @iln/sdk docs:generate` on a machine with at least a 4-core CPU and 8 GB RAM, THE MDX_Generator SHALL complete and write all output files within 30 seconds.
3. IF the TypeScript version resolved in the developer's environment is below 4.6.0 (the minimum version required by TypeDoc), THEN THE MDX_Generator SHALL print a warning to standard error stating both the detected TypeScript version and the minimum required version (4.6.0), then exit with a non-zero status code.
4. IF the `docs:generate` step within `docs:preview` exits with a non-zero status, THEN the `docs:preview` script SHALL NOT start the development server and SHALL propagate the non-zero exit code to the calling shell.
