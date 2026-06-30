# TODO - #578 Enhance SDK Error Messages

- [ ] Gather all places where errors are created/thrown in `sdk/src/**` and how they reach consumers.
- [ ] Audit `sdk/src/errors.ts` (error classes, unique codes, message/remediation quality, context/docs link support).
- [ ] Add/extend structured error fields (code, message, remediation, docsUrl, context, retryable).
- [ ] Improve `parseContractError()` to include richer context (raw contract error, matched signature) and better mapping.
- [ ] Introduce a single `normalizeError()` / `toILNError()` path so callers always receive an `ILNError` with code + context.
- [ ] Update/expand `sdk/src/errors.test.ts` to validate docsUrl, context presence, and code uniqueness.
- [ ] Add a new docs page `docs/errors.md` cataloging error codes with remediation steps and examples.
- [ ] Update any existing troubleshooting docs to link to `docs/errors.md` (and/or anchor links).
- [ ] Run `pnpm -C sdk test` and repo lint/typecheck to ensure the SDK build passes.

