# Production Monitoring and Alert Configuration

This document specifies the production monitoring architecture, alert rules, health check probes, and operational runbooks for the Invoice Liquidity Network (ILN) ecosystem. It covers all five production signals required by the [Mainnet Launch Checklist](./mainnet-launch-checklist.md):

1. **Stellar RPC Node Health & Soroban Availability**
2. **Indexer Ledger Lag & Sync Degradation**
3. **Notification Service & Delivery Failures**
4. **Webhook Delivery Errors & Endpoint Failures**
5. **CI Release Failures & Provenance Failures**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             Monitoring Architecture                         │
└─────────────────────────────────────────────────────────────────────────────┘

    [ Stellar Horizon / Soroban RPC ]
                   ▲
                   │ (HTTP / JSON-RPC Probes)
                   ▼
  ┌─────────────────────────────────┐       ┌─────────────────────────────────┐
  │     Upptime Automated Prober    │       │     Prometheus / OpenTelemetry  │
  │   (.github/workflows/upptime.yml│       │       Metrics & Health Exporter │
  │        + .upptimerc.yml)        │       └────────────────┬────────────────┘
  └────────────────┬────────────────┘                        │
                   │                                         │
                   ▼                                         ▼
  ┌───────────────────────────────────────────────────────────────────────────┐
  │                           Alert Routing Layer                             │
  │       (Slack Webhook / Discord / PagerDuty / GitHub Status Alerts)        │
  └───────────────────────────────────────────────────────────────────────────┘
```

---

## Signal 1: RPC Health & Network Availability

### Signal Description
Probes the liveness and responsiveness of Stellar Horizon endpoints and Soroban RPC nodes for both testnet and mainnet environments.

### Monitoring Mechanism
1. **Upptime Automated Probing** (`.upptimerc.yml`):
   - `Stellar Horizon Testnet`: `GET https://horizon-testnet.stellar.org` (Interval: 5m)
   - `Stellar Horizon Mainnet`: `GET https://horizon.stellar.org` (Interval: 5m)
   - `Soroban RPC Endpoint`: `POST https://soroban-testnet.stellar.org` with `getHealth` and contract data probe (Interval: 5m)
2. **CI Pipeline Health Probing**:
   - Reusable workflow [`.github/workflows/reusable-testnet-health.yml`](../.github/workflows/reusable-testnet-health.yml) executes a 3-attempt validation with backoff before executing deployments or end-to-end integration runs.

### Alert Thresholds & Routing
- **Warning**: HTTP response time > 2500ms for 3 consecutive checks.
- **Critical**: HTTP status != 200 or connection failure / timeout > 5000ms.
- **Routing**: Notifications sent immediately to `#alerts-infra` Slack/Discord channel via `NOTIFICATION_SLACK` in Upptime workflow.

### Triage Runbook
1. Check Stellar network status on [Stellar Dashboard](https://dashboard.stellar.org).
2. Failover to secondary RPC provider (e.g. Validation Cloud / Ankr) by updating `RPC_URL`.
3. If self-hosted, verify quickstart container logs and Horizon ledger ingestion stream.

---

## Signal 2: Indexer Lag & Ingestion Health

### Signal Description
Monitors the gap between the latest closed ledger on Stellar and the indexer's latest processed cursor ledger (`lastSync`).

### Monitoring Mechanism
1. **Health API Endpoint** (`GET /health` & `GET /dashboard` on Indexer):
   ```json
   {
     "status": "ok",
     "db": "ok",
     "lastSync": "2026-08-26T15:20:00.000Z",
     "uptime": 3600000
   }
   ```
2. **Dashboard Metrics** (`GET /dashboard`):
   - `sync.syncLag`: Difference (in seconds) between current server time and `lastSync` timestamp.
   - `sync.isSyncing`: Boolean indicating active polling state.
   - `performance.dbQueryAvgTime`: Database read/write latency.
3. **Automated Ping Probe**:
   - Upptime checks indexer `/health` endpoint every 5 minutes and validates HTTP 200 and `"db": "ok"`.

### Alert Thresholds & Routing
- **Warning**: `syncLag > 60s` (Indexer is falling behind latest ledger closure).
- **Critical**: `syncLag > 300s` or `"status": "degraded"` or `"db": "error"`.
- **Routing**: PagerDuty / Slack `#alerts-indexer`.

### Triage Runbook
1. Query indexer `/health` and `/dashboard` endpoints.
2. Inspect indexer logs for RPC rate-limiting errors (`429 Too Many Requests`) or connection timeouts.
3. Verify SQLite database lock status (`SQLITE_BUSY`) or disk write capacity.
4. If indexer process is stalled, restart the service or execute replay from last confirmed cursor checkpoint.

---

## Signal 3: Notification Service Failures

### Signal Description
Monitors internal service health, queue backlogs, SMS/Email provider connectivity, and digest scheduling failures.

### Monitoring Mechanism
1. **Health Endpoint** (`GET /health` on Notification Service):
   - Returns `{ "status": "ok" }` when the internal poller and dispatch engine are operational.
2. **Delivery Analytics API** (`GET /analytics` & `GET /analytics/trends`):
   - Tracks total sent, failed, retry counts, and success rates across all notification channels (`email`, `sms`, `webhook`).
3. **Queue & Error Logging**:
   - Processor error logs capture template render failures, invalid destination errors, and provider rate-limits.

### Alert Thresholds & Routing
- **Warning**: Channel failure rate > 5% over 15-minute sliding window.
- **Critical**: Service `/health` endpoint unreachable or failure rate > 20%.
- **Routing**: Slack `#alerts-notifications`.

### Triage Runbook
1. Inspect `GET /analytics` for delivery error categorization (e.g. SMTP connection failure, Twilio SMS balance/rate-limit).
2. Check `notifications.db` for stuck delivery tasks.
3. Validate third-party API credentials (`TWILIO_AUTH_TOKEN`, `SMTP_PASSWORD`).

---

## Signal 4: Webhook Delivery Errors

### Signal Description
Monitors HTTP delivery failure rates, retry exhaustion, and signature/timeout errors when delivering event webhooks to subscriber endpoints.

### Monitoring Mechanism
1. **Webhook Delivery Logs & Status** (`GET /subscriptions/:id/logs`):
   - Inspect status codes, response headers, delivery duration, and retry attempts for every webhook payload.
2. **Channel Comparison & Trends Endpoint** (`GET /analytics/channel-comparison`):
   - Aggregates webhook delivery success vs failure counts and average latencies.
3. **Diagnostic Test Webhook API** (`POST /test-webhook`):
   - Direct execution probe for verifying delivery pipeline end-to-end against a test destination.

### Alert Thresholds & Routing
- **Warning**: Consecutive webhook delivery failures across subscribers > 10% within 10 minutes.
- **Critical**: Global webhook dispatcher failure or systematic SSRF filter false-positive blocks.
- **Routing**: Slack `#alerts-notifications`.

### Triage Runbook
1. Inspect webhook delivery logs for HTTP error codes (e.g., 4xx subscriber endpoint errors vs 5xx timeout/network errors).
2. Confirm subscriber endpoint is reachable and not blocking ILN User-Agent or IP ranges.
3. Ensure exponential backoff and dead-letter retry queues are draining normally.

---

## Signal 5: CI Release & Workflow Failures

### Signal Description
Monitors automated release pipelines, SLSA provenance generation, package publishing to npm, and scheduled security/backup workflows.

### Monitoring Mechanism
1. **Release Pipeline Monitoring** [`.github/workflows/release.yml`](../.github/workflows/release.yml) and [`.github/workflows/sdk-release.yml`](../.github/workflows/sdk-release.yml):
   - Automated failure notifications on release jobs.
   - SLSA build provenance verification step using `actions/attest-build-provenance`.
2. **Nightly & Scheduled Workflows**:
   - Indexer nightly backup ([`.github/workflows/indexer-backup.yml`](../.github/workflows/indexer-backup.yml)) with automated GitHub script failure warning.
   - E2E nightly regression suite ([`.github/workflows/e2e-nightly.yml`](../.github/workflows/e2e-nightly.yml)).
   - Snyk scheduled vulnerability scans ([`.github/workflows/snyk.yml`](../.github/workflows/snyk.yml)).

### Alert Thresholds & Routing
- **Warning**: Scheduled nightly backup or E2E workflow failure.
- **Critical**: Release workflow failure during tag publishing, npm token authentication failure, or SLSA provenance generation rejection.
- **Routing**: GitHub Actions failure notifications + maintainer release team dispatch.

### Triage Runbook
1. Review GitHub Actions workflow execution logs.
2. Check `NPM_TOKEN` and `RELEASE_PAT` validity in repository secrets.
3. For provenance errors, confirm OIDC token permissions (`id-token: write`) on release jobs.

---

## Summary Status Table

| Signal | Monitored Target | Probe / Metric Source | Alert Threshold | Target Runbook |
|---|---|---|---|---|
| **RPC Health** | Stellar Horizon & Soroban RPC | Upptime + `reusable-testnet-health.yml` | > 2.5s latency or non-200 | Switch RPC / Check SDF status |
| **Indexer Lag** | SQLite cursor vs Stellar ledger | `/health`, `/dashboard` (`syncLag`) | > 60s warning, > 300s critical | Check RPC / DB lock / Replay |
| **Notification Failures**| Email / SMS / Internal poller | `/health`, `/analytics` | > 5% error rate | Check provider API keys & queues |
| **Webhook Errors** | Subscriber HTTP endpoints | `/subscriptions/:id/logs`, `/analytics` | > 10% delivery failure | Check retry queue & dead-letter |
| **CI Release Failures** | Release workflows & provenance | GitHub Actions (`release.yml`, etc.) | Any workflow exit code != 0 | Check secrets / OIDC / build logs |
