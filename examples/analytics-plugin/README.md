# ILN Analytics Plugin Example

A custom analytics plugin demonstrating the `ILNPlugin` interface. It tracks per-operation counts, success/error rates, and timing, and can optionally batch-flush events to a remote analytics endpoint.

## What it tracks

For every SDK operation (e.g. `submitInvoice`, `fundInvoice`):

| Metric | Description |
|--------|-------------|
| `count` | Total calls |
| `successCount` | Calls that completed without error |
| `errorCount` | Calls that threw an error |
| `totalDurationMs` | Sum of all operation durations |
| `avgDurationMs` | Average duration per call |

## Usage

```ts
import { ILNSdk } from '@iln/sdk';
import { AnalyticsPlugin } from './examples/analytics-plugin';

const sdk = new ILNSdk({
  contractId: '...',
  rpcUrl: '...',
  networkPassphrase: '...',
});

const analytics = new AnalyticsPlugin({
  endpoint: 'https://analytics.example.com/events', // optional
  apiKey: 'your-api-key',                           // optional
  batchSize: 10,                                    // flush every 10 events (default)
});

await sdk.plugins.register(analytics);

// Perform operations normally
await sdk.submitInvoice({ ... });
await sdk.fundInvoice({ ... });

// Read the metrics report at any time
const report = analytics.getReport();
console.log(report);
// {
//   submitInvoice: { count: 1, successCount: 1, errorCount: 0, avgDurationMs: 42 },
//   fundInvoice:   { count: 1, successCount: 1, errorCount: 0, avgDurationMs: 38 },
// }

// Clean up on shutdown
await sdk.plugins.unregister(analytics.name);
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | `""` | Remote URL to POST batched events to. Leave empty to disable flushing. |
| `apiKey` | `string` | `""` | Bearer token sent in the `Authorization` header when flushing. |
| `batchSize` | `number` | `10` | Number of events to accumulate before flushing to the endpoint. |

## Running the tests

```bash
pnpm install
pnpm test
```
