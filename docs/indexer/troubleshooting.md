# Indexer Troubleshooting

Use the checks below against the running indexer before changing its state.
Production logs and resource graphs are available from the Railway service;
local commands assume they are run from the `indexer` directory.

## Health check and database errors

Railway probes `/v1/health`; local monitoring can use that endpoint or the
backward-compatible `/health` route. A healthy response is
`200` JSON with `status: "ok"`, `db: "ok"`, `lastSync`, and `uptime`. A failed
SQLite query returns `503` with `status: "error"` and `db: "error"`.
`/v1/health` returns the same health state. These paths bypass API rate
limiting.

```bash
curl -i http://localhost:3001/health
curl -i http://localhost:3001/v1/health
```

If the endpoint reports a database error, check the configured path and its
parent directory before restarting:

```bash
echo "$DB_PATH"
ls -ld "$(dirname "$DB_PATH")"
ls -l "$DB_PATH"*
```

Create the parent directory and grant the service user write access if it is
missing or not writable. SQLite `SQLITE_BUSY` usually indicates another writer:
run only one indexer process against a database, and keep Railway at one replica.
Do not delete `-wal` or `-shm` files while the process is running.

Database diagnostics:

```bash
sqlite3 "$DB_PATH" "PRAGMA quick_check;"
sqlite3 "$DB_PATH" "SELECT last_ledger, updated_at FROM cursor WHERE id = 1;"
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM invoices;"
sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM events;"
```

Run `VACUUM` only during a planned maintenance window with the indexer stopped
and a verified backup available; it is not a live-query fix.

## Stellar RPC connection and response errors

The configured `RPC_URL` is used by the poller. Confirm its value and call the
RPC health method directly:

```bash
echo "$RPC_URL"
curl -i -X POST "$RPC_URL" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'
```

For `ECONNREFUSED`, timeouts, or invalid JSON, check DNS/TLS and the provider's
status, then verify that the configured URL is the provider's JSON-RPC endpoint.
Use a supported replacement RPC URL if needed. The poller logs failed polling
cycles and schedules another cycle; it does not stop permanently on an RPC
failure.

## Contract ID, event format, and slow synchronization

Check `CONTRACT_ID`, `NETWORK_PASSPHRASE`, and `RPC_URL` together. A contract
deployed on a different Stellar network will not be found when the RPC URL and
network passphrase point elsewhere. The sample environment defaults to testnet;
set all three values explicitly for production.

The poller fetches events in batches of 200 and uses `POLL_INTERVAL_MS`
(default 5000 ms). A slow sync can be caused by a slow or rate-limited RPC
provider, a large backlog, or slow SQLite writes. Check the poller logs, the
database cursor query above, Railway CPU/memory graphs, and RPC-provider
rate-limit information before changing the polling interval. Increasing the
interval reduces calls but can increase catch-up time.

### Ledger reorganization and replay

Each poll starts again from the saved cursor ledger, intentionally overlapping
the last processed ledger. Duplicate event IDs are ignored by the processor,
so the overlap is safe and protects against missing boundary events after a
restart. The current indexer does **not** roll back database rows for events
removed by a chain reorganization; overlap and deduplication are not a full
canonical-chain rollback mechanism.

If an orphaned event is confirmed, take a verified database backup, stop the
indexer, and rebuild into a new database from a known-good ledger using a new
`DB_PATH` and `START_LEDGER`. Validate the new database and sync cursor before
switching traffic back. Do not lower only the existing cursor: already stored
event IDs and invoice state would remain and can mask a correct replay.

## API latency or high resource use

Check Railway's service CPU and memory graphs, the `DB_PATH` file size, and
the database counts/cursor above. The code uses SQLite and is intended to run
as one poller/API process; adding replicas is not a horizontal-scaling fix.
If API latency rises with database size, identify the slow request and query
before scheduling offline database maintenance. Size Railway CPU and memory
from the indexer load-test reports and confirm the selected resource plan with
a repeat test; resource limits are not configured in `railway.toml`.

## Railway startup, port, and restart failures

Railway starts the `web` process from `Procfile` (`node dist/index.js`), with
`PORT` supplied by the platform. The committed `railway.toml` invokes the
`iln-indexer` workspace `start` script, which runs the same command. Check the
Railway deployment/build logs for startup errors and verify `PORT`, `DB_PATH`,
`CONTRACT_ID`, and `RPC_URL`.
Ensure `/data` is a persistent volume and `DB_PATH=/data/indexer.db` for
production so a restart does not discard SQLite state.

The service restarts on process failure with a bounded retry count. A health
check failure is not a substitute for fixing the reported startup or database
error; use the `/health` response and deployment logs to diagnose it.

## Logging

The poller and processor write component-prefixed messages to standard output
and standard error (for example, `[poller] Error during poll`). Use the
platform's log viewer or the foreground `npm start` output. The service does
not currently use a `DEBUG=iln-indexer:*` switch or PM2-managed process, so
those settings/commands do not enable additional logging here.

## Verification coverage

The operational behaviors above are covered by the health/API and rate-limit
tests in `indexer/tests/api.test.ts` and `indexer/tests/rateLimit.test.ts`,
event ingestion and deduplication tests in `indexer/tests/ingestion.test.ts`,
and poller overlap tests in `indexer/tests/poller.test.ts`. Provider reachability,
Railway plan capacity, filesystem permissions on the deployed volume, and
external RPC-provider incidents must still be checked in the target environment;
unit tests cannot establish those remote conditions.
