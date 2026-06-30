# TypeScript Example

This example demonstrates type-safe usage of the ILN SDK with TypeScript.

## Features

- Full type safety with imported interfaces
- Protocol configuration and compatibility checks
- Invoice submission and querying
- Reputation and statistics queries
- Formatted output helpers

## Setup

```bash
cd examples/typescript-example
npm install
cp .env.example .env
# Edit .env with your credentials
```

## Run

```bash
npm start
```

## What It Does

1. Loads and validates configuration from environment variables
2. Checks SDK-to-contract compatibility
3. Submits a new invoice for 10 USDC with 5% discount
4. Queries invoice details with full type information
5. Checks freelancer reputation score
6. Fetches protocol-wide statistics

## TypeScript Interfaces

The example imports and uses these key types:

- `Invoice` — Full invoice data from the contract
- `ProtocolConfig` — Protocol-level configuration
- `BatchResult` — Result of batch operations
