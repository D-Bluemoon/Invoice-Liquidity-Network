# Architecture

This document describes the architecture of the ILN Indexer service.

## System Overview

The ILN Indexer is a Node.js service that:

1. Polls Stellar RPC nodes for contract events
2. Processes and stores invoice data in SQLite
3. Serves a REST API for querying the indexed data

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        ILN Indexer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Poller    │───▶│  Processor  │───▶│   Database  │         │
│  │             │    │             │    │   (SQLite)  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│         │                                     │                 │
│         │                                     ▼                 │
│         │                              ┌─────────────┐         │
│         │                              │  REST API   │         │
│         │                              │  (Express)  │         │
│         │                              └─────────────┘         │
│         │                                     │                 │
│         │                                     ▼                 │
│         │                              ┌─────────────┐         │
│         │                              │   Cache     │         │
│         │                              │ (Memory/Redis)│       │
│         │                              └─────────────┘         │
│         │                                                       │
│         ▼                                                       │
│  ┌─────────────┐                                               │
│  │ Stellar RPC │                                               │
│  │    Node     │                                               │
│  └─────────────┘                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Poller (`poller.ts`)

The Poller is responsible for fetching events from the Stellar blockchain.

**Key Responsibilities**:
- Determine the starting ledger for polling
- Fetch events in batches (200 events per batch)
- Handle pagination using cursors
- Manage the stored cursor position

**Polling Strategy**:
1. On first run, starts from `START_LEDGER` or automatically detects (latest - 1000 ledgers)
2. Re-scans from the last processed ledger on each poll for resilience
3. Processes events in batches to handle large volumes
4. Advances the cursor only after successful processing

**Resilience**:
- Re-scans the last processed ledger to handle ledger re-orgs
- Event deduplication ensures no duplicate processing
- Errors are logged but don't stop the polling loop

### 2. Processor (`processor.ts`)

The Processor handles individual contract events.

**Event Processing Flow**:
1. **Deduplication**: Check if event ID has been processed before
2. **Decoding**: Extract event type and invoice ID from Soroban values
3. **Persistence**: Store event record in SQLite
4. **State Sync**: Fetch current invoice state from RPC and upsert

**Supported Event Types**:
- `submitted` - New invoice created
- `funded` - Invoice funded by LP
- `paid` - Invoice marked as paid
- `defaulted` - Invoice defaulted

**Why Fetch from RPC?**
The processor always fetches the current invoice state from the RPC node rather than parsing all fields from events. This ensures:
- Accurate state even if events are processed out-of-order
- Handles ledger re-orgs gracefully
- Simplifies event processing logic

### 3. Database (`db.ts`)

SQLite database with WAL mode for concurrent read performance.

**Schema**:

```sql
-- Invoices table
CREATE TABLE invoices (
  id            INTEGER PRIMARY KEY,
  freelancer    TEXT    NOT NULL,
  payer         TEXT    NOT NULL,
  amount        TEXT    NOT NULL,  -- i128 stored as string
  due_date      INTEGER NOT NULL,
  discount_rate INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'Pending',
  funder        TEXT,
  funded_at     INTEGER,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

-- Events table for deduplication
CREATE TABLE events (
  event_id         TEXT    PRIMARY KEY,
  event_type       TEXT    NOT NULL,
  invoice_id       INTEGER NOT NULL,
  ledger           INTEGER NOT NULL,
  ledger_closed_at TEXT    NOT NULL,
  created_at       INTEGER NOT NULL
);

-- Cursor table for tracking sync position
CREATE TABLE cursor (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  last_ledger  INTEGER NOT NULL DEFAULT 0,
  updated_at   INTEGER NOT NULL
);
```

**Indexes**:
- `idx_invoices_status` - Fast status filtering
- `idx_invoices_freelancer` - Fast freelancer queries
- `idx_invoices_payer` - Fast payer queries
- `idx_invoices_funder` - Fast funder queries
- `idx_events_invoice_id` - Fast event lookup by invoice

### 4. REST API (`api.ts`)

Express-based HTTP server with middleware for:
- Rate limiting
- JSON parsing
- Trust proxy configuration

**Middleware Stack**:
1. Trust proxy (for rate limiting behind reverse proxies)
2. Rate limiter
3. JSON body parser
4. Route handlers

### 5. Cache (`cache.ts`)

Two-tier caching system:
1. **In-memory**: Default, fast, no external dependencies
2. **Redis**: Optional, distributed, persists across restarts

**Cache Strategy**:
- Invoice queries are cached for 60 seconds
- Cache is invalidated when new events are processed
- Stats are cached for 30 seconds

## Data Flow

```
1. Poller fetches events from Stellar RPC
         │
         ▼
2. Processor receives each event
         │
         ▼
3. Check deduplication (has event been processed?)
         │
         ├── Yes → Skip
         │
         ▼ No
4. Store event record in SQLite
         │
         ▼
5. Fetch current invoice state from RPC
         │
         ▼
6. Upsert invoice into SQLite
         │
         ▼
7. Invalidate cache for this invoice
         │
         ▼
8. API serves requests using cached/uncached data
```

## Configuration

All configuration is via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| CONTRACT_ID | - | ILN contract address |
| NETWORK_PASSPHRASE | Test SDF Network | Stellar network passphrase |
| RPC_URL | https://soroban-testnet.stellar.org | Stellar RPC endpoint |
| DB_PATH | indexer.db | SQLite database path |
| POLL_INTERVAL_MS | 5000 | Polling interval in ms |
| PORT | 3001 | API server port |
| START_LEDGER | 0 | Starting ledger (0 = auto) |
| REDIS_URL | - | Redis URL (optional) |
| RATE_LIMIT_WINDOW_MS | 60000 | Rate limit window |
| RATE_LIMIT_MAX | 100 | Max requests per window |
| RATE_LIMIT_WHITELIST | - | Comma-separated IPs |

## Deployment

See [Deployment Guide](./deployment.md) for production deployment instructions.

## Performance Considerations

1. **Batch Processing**: Events are fetched in batches of 200 to reduce RPC calls
2. **WAL Mode**: SQLite uses Write-Ahead Logging for better concurrent read performance
3. **Caching**: API responses are cached to reduce database load
4. **Indexing**: Database indexes optimize common query patterns
5. **Rate Limiting**: Prevents abuse and ensures fair resource usage

## Monitoring

- **Health Endpoint**: `/health` provides service status
- **Logs**: Console logs for polling cycles and errors
- **Metrics**: Uptime and last sync time available via health endpoint
