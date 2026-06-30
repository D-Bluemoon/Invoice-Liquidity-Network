# ILN Indexer Documentation

The ILN Indexer is a service that indexes events from the Invoice Liquidity Network Soroban contract and provides a REST API for querying invoice data, protocol statistics, and liquidity provider information.

## Table of Contents

- [Architecture](./architecture.md) - System design and component overview
- [API Reference](./api-reference.md) - Complete REST API documentation
- [Deployment Guide](./deployment.md) - Instructions for deploying the indexer
- [Configuration](./configuration.md) - Environment variables and settings
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start the indexer
npm run start
```

The indexer will start polling for contract events and serve the REST API on port 3001 (configurable).

## Features

- **Event Indexing**: Automatically indexes all ILN contract events (invoice submissions, fundings, payments, defaults)
- **REST API**: Query invoices, protocol stats, LP statistics, and freelancer data
- **Caching**: Optional Redis caching for improved API performance
- **Rate Limiting**: Built-in rate limiting for public API access
- **Pagination**: Cursor-based pagination for large result sets
- **Health Monitoring**: Health check endpoint with database status

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Stellar   │────▶│   Poller    │────▶│  Processor  │
│   RPC Node  │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Cursor    │     │   SQLite    │
                    │  Management │     │  Database   │
                    └─────────────┘     └─────────────┘
                                              │
                                              ▼
                                       ┌─────────────┐
                                       │  REST API   │
                                       │  (Express)  │
                                       └─────────────┘
```

## Components

### Poller
Continuously polls the Stellar RPC node for new contract events. Uses cursor-based pagination to efficiently fetch events in batches.

### Processor
Processes each event, deduplicates using event IDs, and upserts invoice data into SQLite.

### REST API
Express-based HTTP server providing endpoints for querying indexed data. Includes caching, rate limiting, and health checks.

### Database
SQLite database storing invoices, events, and cursor state. Uses WAL mode for better concurrent read performance.
