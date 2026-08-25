# Oracle Service

Off-chain payer verification for `fund_invoice()`'s `require_oracle_verification`
path. Two independent signals feed one verdict, and the service is held to a
higher coverage bar than the rest of the monorepo because a bug here releases
funds against an invoice that should have been rejected.

## Signal composition

Two signals, answering different questions:

| Signal | Question | Time horizon |
| --- | --- | --- |
| Fraud heuristic | Is this payer's *recent on-chain behaviour* consistent with a legitimate invoice? | Rolling 24h / 30d windows |
| External provider (KYB) | Is this legal entity *who they claim to be*? | Months |

### The policy

**Fraud signals are blocking, and a KYB pass cannot clear them.** A verified
business can still be compromised, coerced, or committing fraud; an identity
attestation says nothing about whether the current burst of near-identical
invoices is real. If KYB could override a fraud flag, the attestation would
become the single most valuable thing to obtain before an attack.

**A missing or negative KYB result is not blocking.** The protocol funds
pseudonymous on-chain payers by design, and most legitimate payers will never
appear in a KYB database. The external signal moves *confidence*, not the
verdict:

| External status | Effect |
| --- | --- |
| `verified` | Confidence bonus (+0.15, scaled by the provider's own confidence) |
| `unverified` | Confidence capped at 0.6 |
| `unknown` | No adjustment at all |

`unknown` is deliberately distinct from `unverified`. A provider that is not
configured, times out, or has no record tells us nothing, and "we could not
check" must never be read as "we checked and they failed" — otherwise a provider
outage silently degrades every verdict in the system.

Confidence still has to clear the same 0.55 threshold, so a capped confidence
*can* flip a marginal verdict to rejected. That is the mechanism by which a weak
external signal tightens the bar without being an outright veto.

### Precedence

1. Stale source data → `rejected-stale-data`
2. Any fraud signal → `rejected-fraud-signals` (KYB cannot clear)
3. Trust or confidence below threshold → `rejected-low-trust`
4. Otherwise → `verified-both` or `verified-heuristic-only`

Staleness outranks fraud only because a stale assessment is not evidence of
anything — reporting a fraud verdict we cannot stand behind would be worse than
declining to answer.

### The response

Every verification carries a `composition` object with both sub-scores, not just
the final boolean, so `OracleBadge` can render the four cases distinctly:

```jsonc
{
  "isVerified": false,
  "confidence": 0.8,
  "composition": {
    "policy": "heuristic-blocking-v1",
    "outcome": "rejected-fraud-signals",
    "rationale": "Fraud heuristics fired. External KYB verification does not clear behavioural fraud signals.",
    "heuristic": { "trustScore": 85, "confidence": 0.8, "confidenceLevel": "high", "fraudSignals": ["..."], "passed": false },
    "external":  { "status": "verified", "provider": "acme-kyb", "providerConfidence": null, "checkedAt": null, "reasons": [] },
    "baseConfidence": 0.8,
    "composedConfidence": 0.8
  }
}
```

`policy` is versioned so stored verdicts stay auditable when the rules change.

### Wiring a provider

`ExternalVerificationProvider` is a plain port — no provider is bundled:

```ts
const { app } = await createOracleApp({
  externalProvider: async (payer) => ({
    status: (await lookupKyb(payer)) ? 'verified' : 'unverified',
    provider: 'acme-kyb',
    providerConfidence: 0.9,
  }),
});
```

A provider that throws is reported as `unknown`, never `unverified`.

## Cache staleness

Verification results are cached, keyed on `payer:amount:invoiceId`. Fraud
heuristics are time-sensitive by construction — rapid-succession and
similar-amount detection both look at rolling windows — so a clean verdict is
only true as of the instant it was computed. Cached for the full 300 s, it
becomes a window in which a payer who has *just* started behaving fraudulently
still reads as clean.

Two mitigations, both in `cache.ts`:

**Asymmetric TTL.** A stale *clean* verdict is a security failure: bad actors
read as good. A stale *flagged* verdict is not: good actors read as bad, which
costs a re-check and fails safe. So clean verdicts for payers with activity
inside the rapid-succession window get 30 s; everything else keeps 300 s. Keeping
the full TTL on flagged verdicts also stops an attacker re-querying to grind out
a clean result.

**Explicit invalidation.** `POST /v1/cache/invalidate { payer }` drops every
cached verdict for a payer. The indexer calls this when it observes new activity,
so a clean verdict cannot outlive the behaviour it was computed from. Redis uses
`SCAN`, not `KEYS`, so invalidation never blocks the Redis event loop.

Callers can also pass `forceRefresh: true` to bypass the cache for a single
request.

## Monitoring

`/metrics` and `/v1/metrics` expose Prometheus text exposition.

| Metric | Type | Purpose |
| --- | --- | --- |
| `oracle_verification_requests_total` | counter | Request volume |
| `oracle_verification_duration_seconds` | histogram | Latency |
| `oracle_cache_hits_total` / `_misses_total` | counter | Cache effectiveness |
| `oracle_stale_responses_total` | counter | Upstream data freshness |
| `oracle_verification_outcome_total` | counter | Verdicts by outcome, external status, cache hit |
| `oracle_fraud_signal_total` | counter | Individual heuristics as they fire |
| `oracle_fraud_flag_ratio` | gauge | Share of the last 200 verdicts carrying a fraud signal |
| `oracle_external_verification_total` | counter | Provider lookups by status |

`oracle_fraud_flag_ratio` exists because the alert that matters — a sudden spike
in fraud-flagged submissions — is a question about the *share* of verdicts, not
the count. Cache hits are excluded from the ratio: they are replays of an earlier
verdict, and counting them would let one flagged payer retrying in a loop page
someone for a single actor.

### Setup

- Scrape config: `monitoring/prometheus/scrape-oracle-service.yml`. The job label
  must stay `oracle-service` — the `OracleNoVerifications` rule joins against
  `up{job="oracle-service"}`.
- Alert rules: `monitoring/prometheus/oracle-service-alerts.yml`.
- Uptime: `.upptimerc.yml` checks `/v1/health`, which reports `degraded` after a
  verification failure. A root check would keep returning 200 through exactly the
  failure worth knowing about.

### Alerts

| Alert | Condition | Severity |
| --- | --- | --- |
| `OracleFraudFlagRateHigh` | 10m avg fraud-flag ratio > 25% | warning |
| `OracleFraudFlagRateCritical` | 5m avg > 60% | critical |
| `OracleNoVerifications` | no verifications for 15m while up | warning |
| `OracleAllVerificationsRejected` | >95% rejected over 10m | critical |
| `OracleStaleResponsesRising` | any stale response in 10m | warning |
| `OracleVerificationLatencyHigh` | p95 > 2s for 10m | warning |
| `OracleCacheHitRateLow` | hit rate < 20% for 15m | warning |
| `OracleExternalProviderUnavailable` | >50% `unknown` for 10m | warning |

A fraud-rate spike is either an attack or a heuristic regression. Check
`oracle_fraud_signal_total` to tell them apart: a single signal dominating points
at a bug, a spread across signals points at an attack.

`OracleNoVerifications` covers the failure a plain uptime check misses — the
service answering `/health` with 200 while verifying nothing.

## Testing

```bash
cd oracle-service
pnpm install --ignore-workspace
pnpm test              # unit tests
pnpm test:coverage     # enforces the 95% gate
```

The 95% threshold lives in `oracle-service/vitest.config.ts`, so local runs
enforce the same bar as CI (`.github/workflows/coverage.yml`). `testFixtures.ts`
is excluded from coverage — it is scaffolding, and counting it would inflate the
figure the gate exists to protect.

oracle-service is not a pnpm workspace member, hence `--ignore-workspace`.
