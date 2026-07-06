import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { parseArgs } from "util";

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  dim: "\x1b[2m",
};

interface TestRequest {
  name: string;
  path: string;
  method: "GET" | "POST";
  body?: string;
  headers?: Record<string, string>;
}

interface RequestRecord {
  name: string;
  url: string;
  method: string;
  latency: number;
  status: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface LoadTestConfig {
  service: "indexer" | "notifications" | "both";
  duration: number; // in seconds
  concurrency: number;
  indexerUrl: string;
  notificationsUrl: string;
  reportPath: string;
  jsonPath: string;
  p95Threshold: number; // in ms
  errorThreshold: number; // in %
  avgThreshold: number; // in ms
  rpsThreshold: number; // requests/sec
}

function printUsage() {
  console.log(`
${colors.bright}${colors.cyan}ILN Load Testing Tool${colors.reset}
Usage: npx ts-node --esm scripts/load-test.ts [options]

Options:
  --service <indexer|notifications|both>   Target service to test (default: both)
  --duration <seconds>                     Duration of the stress test (default: 10)
  --concurrency <count>                    Number of concurrent workers (default: 5)
  --indexer-url <url>                      URL of the Indexer service (default: http://localhost:3001)
  --notifications-url <url>                URL of the Notifications service (default: http://localhost:4001)
  --report <filepath>                      Markdown report destination (default: load-test-report.md)
  --json <filepath>                        JSON raw log destination (default: load-test-results.json)
  
Threshold Alerts Settings:
  --p95-threshold <ms>                     95th percentile latency limit in ms (default: 500)
  --error-threshold <pct>                  Allowed error percentage (default: 2)
  --avg-threshold <ms>                     Average latency limit in ms (default: 200)
  --rps-threshold <count>                  Minimum required throughput (default: 10)
  -h, --help                               Show this help screen
`);
}

function getRandomStellarAddress(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let result = "G";
  for (let i = 0; i < 55; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getIndexerRequests(baseUrl: string): TestRequest[] {
  const randomAddress = getRandomStellarAddress();
  const randomInvoiceId = Math.floor(Math.random() * 50) + 1;

  return [
    { name: "Indexer Health", method: "GET", path: `${baseUrl}/v1/health` },
    { name: "Indexer Invoices List", method: "GET", path: `${baseUrl}/v1/invoices?limit=10` },
    { name: "Indexer Stats", method: "GET", path: `${baseUrl}/v1/stats` },
    { name: "Indexer Top LPs", method: "GET", path: `${baseUrl}/v1/lps/top?limit=5` },
    { name: "Indexer LP Stats", method: "GET", path: `${baseUrl}/v1/lps/${randomAddress}/stats` },
    { name: "Indexer Freelancer Stats", method: "GET", path: `${baseUrl}/v1/freelancers/${randomAddress}/stats` },
    { name: "Indexer Invoice History", method: "GET", path: `${baseUrl}/v1/history/${randomAddress}` },
    { name: "Indexer Get Invoice by ID", method: "GET", path: `${baseUrl}/v1/invoice/${randomInvoiceId}` },
    {
      name: "Indexer GraphQL Health",
      method: "POST",
      path: `${baseUrl}/graphql`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { health { status db uptime } }" }),
    },
    {
      name: "Indexer GraphQL Protocol Stats",
      method: "POST",
      path: `${baseUrl}/graphql`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { protocolStats { totalInvoices totalVolume totalYield defaultRate } }" }),
    },
    {
      name: "Indexer GraphQL Top LPs",
      method: "POST",
      path: `${baseUrl}/graphql`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "query { topLPs(limit: 5, period: \"all\") { address yield invoiceCount } }" }),
    },
  ];
}

function getNotificationRequests(baseUrl: string): TestRequest[] {
  const randomAddress = getRandomStellarAddress();
  const randomSubId = Math.floor(Math.random() * 20) + 1;
  const randomEmail = `loadtest_${Math.floor(Math.random() * 100000)}@iln-test.com`;

  return [
    { name: "Notifications Health", method: "GET", path: `${baseUrl}/health` },
    { name: "Notifications Analytics", method: "GET", path: `${baseUrl}/analytics` },
    { name: "Notifications Channel Comparison", method: "GET", path: `${baseUrl}/analytics/channel-comparison` },
    { name: "Notifications Trends", method: "GET", path: `${baseUrl}/analytics/trends?days=7` },
    { name: "Notifications Get Subscriptions", method: "GET", path: `${baseUrl}/subscriptions/${randomAddress}` },
    { name: "Notifications Get Subscription Logs", method: "GET", path: `${baseUrl}/subscriptions/${randomSubId}/logs` },
    {
      name: "Notifications Subscribe Webhook",
      method: "POST",
      path: `${baseUrl}/subscribe`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stellar_address: randomAddress,
        channel: "webhook",
        destination: `https://example.com/webhook/${Math.random().toString(36).substring(7)}`,
        triggers: ["invoice_funded", "invoice_paid"],
        webhook_secret: "loadtest-secret-key",
      }),
    },
    {
      name: "Notifications Subscribe Email",
      method: "POST",
      path: `${baseUrl}/subscribe`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stellar_address: randomAddress,
        channel: "email",
        destination: randomEmail,
        triggers: ["invoice_funded", "invoice_due_soon"],
      }),
    },
    {
      name: "Notifications Test Webhook",
      method: "POST",
      path: `${baseUrl}/test-webhook`,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: randomSubId }),
    },
  ];
}

async function executeRequest(req: TestRequest, timeoutMs = 5000): Promise<{ status: number; ok: boolean; error?: string }> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  const fetchFn = (globalThis as any).fetch || fetch;

  try {
    const response = await fetchFn(req.path, {
      method: req.method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });

    // Read the response text to fully release the network resources
    await response.text();

    return {
      status: response.status,
      ok: response.ok,
    };
  } catch (err: any) {
    return {
      status: 0,
      ok: false,
      error: err.name === "AbortError" ? "Timeout" : err.message || String(err),
    };
  } finally {
    clearTimeout(id);
  }
}

function calculatePercentiles(latencies: number[]): {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };

  return {
    min,
    max,
    avg,
    p50: getPercentile(50),
    p90: getPercentile(90),
    p95: getPercentile(95),
    p99: getPercentile(99),
  };
}

async function main() {
  // Parse command line arguments
  let args;
  try {
    args = parseArgs({
      options: {
        service: { type: "string", default: "both" },
        duration: { type: "string", default: "10" },
        concurrency: { type: "string", default: "5" },
        "indexer-url": { type: "string", default: "http://localhost:3001" },
        "notifications-url": { type: "string", default: "http://localhost:4001" },
        report: { type: "string", default: "load-test-report.md" },
        json: { type: "string", default: "load-test-results.json" },
        "p95-threshold": { type: "string", default: "500" },
        "error-threshold": { type: "string", default: "2" },
        "avg-threshold": { type: "string", default: "200" },
        "rps-threshold": { type: "string", default: "10" },
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (err: any) {
    console.error(`${colors.red}Error parsing arguments: ${err.message}${colors.reset}`);
    printUsage();
    process.exit(1);
  }

  if (args.values.help) {
    printUsage();
    process.exit(0);
  }

  const config: LoadTestConfig = {
    service: (args.values.service || "both") as any,
    duration: parseInt(args.values.duration || "10", 10),
    concurrency: parseInt(args.values.concurrency || "5", 10),
    indexerUrl: args.values["indexer-url"] || "http://localhost:3001",
    notificationsUrl: args.values["notifications-url"] || "http://localhost:4001",
    reportPath: args.values.report || "load-test-report.md",
    jsonPath: args.values.json || "load-test-results.json",
    p95Threshold: parseFloat(args.values["p95-threshold"] || "500"),
    errorThreshold: parseFloat(args.values["error-threshold"] || "2"),
    avgThreshold: parseFloat(args.values["avg-threshold"] || "200"),
    rpsThreshold: parseFloat(args.values["rps-threshold"] || "10"),
  };

  if (!["indexer", "notifications", "both"].includes(config.service)) {
    console.error(`${colors.red}Invalid service value: ${config.service}. Must be "indexer", "notifications", or "both".${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.bright}${colors.magenta}=== INITIATING INVOICE LIQUIDITY NETWORK LOAD TEST ===${colors.reset}`);
  console.log(`${colors.bright}Target Service:${colors.reset}   ${config.service.toUpperCase()}`);
  console.log(`${colors.bright}Duration:${colors.reset}         ${config.duration} seconds`);
  console.log(`${colors.bright}Concurrency:${colors.reset}      ${config.concurrency} concurrent workers`);
  if (config.service === "indexer" || config.service === "both") {
    console.log(`${colors.bright}Indexer URL:${colors.reset}      ${config.indexerUrl}`);
  }
  if (config.service === "notifications" || config.service === "both") {
    console.log(`${colors.bright}Notifications URL:${colors.reset} ${config.notificationsUrl}`);
  }
  console.log(`${colors.bright}Thresholds:${colors.reset}       Avg: ${config.avgThreshold}ms | p95: ${config.p95Threshold}ms | Error: ${config.errorThreshold}% | Min RPS: ${config.rpsThreshold}\n`);

  const results: RequestRecord[] = [];
  const testStartTime = Date.now();
  const testEndTime = testStartTime + config.duration * 1000;

  // Active worker simulation
  const runWorker = async (workerId: number) => {
    while (Date.now() < testEndTime) {
      // Assemble pool of requests based on configuration
      const pool: TestRequest[] = [];
      if (config.service === "indexer" || config.service === "both") {
        pool.push(...getIndexerRequests(config.indexerUrl));
      }
      if (config.service === "notifications" || config.service === "both") {
        pool.push(...getNotificationRequests(config.notificationsUrl));
      }

      if (pool.length === 0) {
        throw new Error("Empty request pool configured");
      }

      // Pick a random request to execute
      const target = pool[Math.floor(Math.random() * pool.length)];
      const reqStart = Date.now();

      const response = await executeRequest(target);

      const latency = Date.now() - reqStart;

      results.push({
        name: target.name,
        url: target.path,
        method: target.method,
        latency,
        status: response.status,
        success: response.ok,
        error: response.error,
        timestamp: reqStart,
      });

      // Brief dynamic delay to prevent freezing the JS event loop
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  };

  // Spawn parallel concurrent workers
  const workerPromises = Array.from({ length: config.concurrency }).map((_, idx) => runWorker(idx));
  await Promise.all(workerPromises);

  const testActualDurationMs = Date.now() - testStartTime;
  const testActualDurationSec = testActualDurationMs / 1000;

  console.log(`${colors.green}Simulations complete. Analyzing load test metrics...${colors.reset}\n`);

  // --- Compile Metrics ---
  const totalRequests = results.length;
  const successCount = results.filter((r) => r.success).length;
  const failedCount = totalRequests - successCount;
  const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
  const errorRate = totalRequests > 0 ? (failedCount / totalRequests) * 100 : 0;
  const rps = testActualDurationSec > 0 ? totalRequests / testActualDurationSec : 0;

  const allLatencies = results.map((r) => r.latency);
  const globalPercentiles = calculatePercentiles(allLatencies);

  // Group stats by endpoint
  const endpointGroups = new Map<string, { latencies: number[]; success: number; failed: number; method: string; url: string }>();
  for (const r of results) {
    if (!endpointGroups.has(r.name)) {
      endpointGroups.set(r.name, { latencies: [], success: 0, failed: 0, method: r.method, url: r.url });
    }
    const g = endpointGroups.get(r.name)!;
    g.latencies.push(r.latency);
    if (r.success) g.success++;
    else g.failed++;
  }

  const endpointStats = Array.from(endpointGroups.entries()).map(([name, g]) => {
    const p = calculatePercentiles(g.latencies);
    return {
      name,
      method: g.method,
      url: g.url,
      total: g.latencies.length,
      success: g.success,
      failed: g.failed,
      successRate: g.latencies.length > 0 ? (g.success / g.latencies.length) * 100 : 0,
      min: p.min,
      max: p.max,
      avg: p.avg,
      p95: p.p95,
    };
  });

  // Group error counts
  const errorDetails = new Map<string, number>();
  for (const r of results) {
    if (!r.success) {
      const errStr = r.error || `HTTP Status ${r.status}`;
      errorDetails.set(errStr, (errorDetails.get(errStr) || 0) + 1);
    }
  }

  // --- Check Threshold Alerts ---
  const alerts: string[] = [];
  const thresholdsPassed = {
    avgLatency: true,
    p95Latency: true,
    errorRate: true,
    rps: true,
  };

  if (globalPercentiles.avg > config.avgThreshold) {
    thresholdsPassed.avgLatency = false;
    alerts.push(`Average response time (${globalPercentiles.avg.toFixed(2)}ms) exceeded the threshold of ${config.avgThreshold}ms`);
  }
  if (globalPercentiles.p95 > config.p95Threshold) {
    thresholdsPassed.p95Latency = false;
    alerts.push(`95th percentile latency (${globalPercentiles.p95.toFixed(2)}ms) exceeded the threshold of ${config.p95Threshold}ms`);
  }
  if (errorRate > config.errorThreshold) {
    thresholdsPassed.errorRate = false;
    alerts.push(`Error rate (${errorRate.toFixed(2)}%) exceeded the threshold of ${config.errorThreshold}%`);
  }
  if (rps < config.rpsThreshold) {
    thresholdsPassed.rps = false;
    alerts.push(`Throughput (${rps.toFixed(2)} RPS) was below the threshold of ${config.rpsThreshold} RPS`);
  }

  // Print results summary to console
  console.log(`${colors.bright}${colors.cyan}=== LOAD TEST SUMMARY ===${colors.reset}`);
  console.log(`Elapsed Time:          ${testActualDurationSec.toFixed(2)}s`);
  console.log(`Total Requests:        ${totalRequests}`);
  console.log(`Successful Requests:   ${colors.green}${successCount}${colors.reset}`);
  console.log(`Failed Requests:       ${failedCount > 0 ? colors.red : colors.green}${failedCount}${colors.reset}`);
  console.log(`Success Rate:          ${successRate.toFixed(2)}%`);
  console.log(`Error Rate:            ${errorRate.toFixed(2)}%`);
  console.log(`Throughput:            ${rps.toFixed(2)} req/sec`);
  console.log();
  console.log(`${colors.bright}${colors.cyan}=== LATENCY PERCENTILES ===${colors.reset}`);
  console.log(`Average:               ${globalPercentiles.avg.toFixed(2)} ms`);
  console.log(`Min:                   ${globalPercentiles.min.toFixed(2)} ms`);
  console.log(`p50 (Median):          ${globalPercentiles.p50.toFixed(2)} ms`);
  console.log(`p90:                   ${globalPercentiles.p90.toFixed(2)} ms`);
  console.log(`p95:                   ${globalPercentiles.p95.toFixed(2)} ms`);
  console.log(`p99:                   ${globalPercentiles.p99.toFixed(2)} ms`);
  console.log(`Max:                   ${globalPercentiles.max.toFixed(2)} ms`);
  console.log();

  console.log(`${colors.bright}${colors.cyan}=== ENDPOINT DETAILS ===${colors.reset}`);
  console.log(
    `%-35s %-6s %-8s %-12s %-10s %-10s`.replace(/%-?\d+s/g, (m) => {
      const len = parseInt(m.match(/\d+/)![0], 10);
      return `%- ${len}s`;
    }),
    "Endpoint Name",
    "Method",
    "Requests",
    "Success Rate",
    "Avg Latency",
    "p95 Latency"
  );
  console.log("-".repeat(88));
  for (const s of endpointStats) {
    console.log(
      `%-35s %-6s %-8d %-12s %-10s %-10s`,
      s.name.substring(0, 34),
      s.method,
      s.total,
      `${s.successRate.toFixed(1)}%`,
      `${s.avg.toFixed(1)}ms`,
      `${s.p95.toFixed(1)}ms`
    );
  }
  console.log();

  // Print Threshold Alerts to console
  if (alerts.length > 0) {
    console.log(`${colors.bright}${colors.red}=== THRESHOLD ALERTS ===${colors.reset}`);
    for (const alert of alerts) {
      console.log(`${colors.red}⚠️  [ALERT] ${alert}${colors.reset}`);
    }
    console.log();
  } else {
    console.log(`${colors.bright}${colors.green}✅ All performance thresholds satisfied successfully!${colors.reset}\n`);
  }

  // --- Report Generation: Markdown ---
  const statusBox =
    alerts.length > 0
      ? `> [!WARNING]
> **Performance thresholds breached!**
> The following SLA thresholds were violated during stress testing:
${alerts.map((a) => `> - ⚠️ ${a}`).join("\n")}`
      : `> [!NOTE]
> **Performance SLA validation passed!**
> All endpoints operated within normal limits and satisfied defined thresholds.`;

  const mdReport = `# Invoice Liquidity Network Load Test Report

This report summarizes stress testing metrics collected during simulated client traffic.

## Test Metadata
- **Date/Time:** ${new Date().toISOString()}
- **Target Service:** \`${config.service}\`
- **Configured Duration:** ${config.duration} seconds
- **Actual Duration:** ${testActualDurationSec.toFixed(2)} seconds
- **Concurrent Workers (VUs):** ${config.concurrency}
- **Total Requests Sent:** ${totalRequests}

---

${statusBox}

---

## Global Performance Metrics

| Metric | Measured Value | Threshold | Status |
|---|---|---|---|
| **Throughput** | ${rps.toFixed(2)} RPS | &ge; ${config.rpsThreshold} RPS | ${thresholdsPassed.rps ? "✅ PASS" : "❌ FAIL"} |
| **Average Latency** | ${globalPercentiles.avg.toFixed(2)} ms | &le; ${config.avgThreshold} ms | ${thresholdsPassed.avgLatency ? "✅ PASS" : "❌ FAIL"} |
| **p95 Latency** | ${globalPercentiles.p95.toFixed(2)} ms | &le; ${config.p95Threshold} ms | ${thresholdsPassed.p95Latency ? "✅ PASS" : "❌ FAIL"} |
| **Error Rate** | ${errorRate.toFixed(2)}% | &le; ${config.errorThreshold}% | ${thresholdsPassed.errorRate ? "✅ PASS" : "❌ FAIL"} |

## Latency Percentiles

| Percentile | Latency (ms) |
|---|---|
| **Min** | ${globalPercentiles.min.toFixed(2)} ms |
| **p50 (Median)** | ${globalPercentiles.p50.toFixed(2)} ms |
| **p90** | ${globalPercentiles.p90.toFixed(2)} ms |
| **p95** | ${globalPercentiles.p95.toFixed(2)} ms |
| **p99** | ${globalPercentiles.p99.toFixed(2)} ms |
| **Max** | ${globalPercentiles.max.toFixed(2)} ms |

## Endpoint Summary

| Endpoint Name | Method | Total Requests | Success Rate | Avg Latency (ms) | p95 Latency (ms) |
|---|---|---|---|---|---|
${endpointStats
  .map(
    (s) =>
      `| ${s.name} | \`${s.method}\` | ${s.total} | ${s.successRate.toFixed(2)}% | ${s.avg.toFixed(2)} ms | ${s.p95.toFixed(2)} ms |`
  )
  .join("\n")}

${
  errorDetails.size > 0
    ? `## Error Breakdown

| Error Description / Status Code | Frequency |
|---|---|
${Array.from(errorDetails.entries())
  .map(([desc, freq]) => `| ${desc} | ${freq} |`)
  .join("\n")}`
    : ""
}

---
*Report generated automatically by the ILN load testing suite.*
`;

  try {
    writeFileSync(resolve(process.cwd(), config.reportPath), mdReport, "utf-8");
    console.log(`Markdown report saved to: ${colors.bright}${config.reportPath}${colors.reset}`);
  } catch (err: any) {
    console.error(`${colors.red}Failed to write markdown report: ${err.message}${colors.reset}`);
  }

  // --- Report Generation: JSON ---
  const jsonReport = {
    metadata: {
      timestamp: new Date().toISOString(),
      service: config.service,
      durationSeconds: testActualDurationSec,
      concurrency: config.concurrency,
      totalRequests,
      successCount,
      failedCount,
      successRate,
      errorRate,
      rps,
    },
    thresholds: {
      avgLatencyMs: config.avgThreshold,
      p95LatencyMs: config.p95Threshold,
      errorRatePercent: config.errorThreshold,
      minRps: config.rpsThreshold,
      passed: alerts.length === 0,
      violations: alerts,
    },
    latencies: globalPercentiles,
    endpoints: endpointStats,
    errors: Array.from(errorDetails.entries()).map(([error, count]) => ({ error, count })),
    rawRequests: results.map((r) => ({
      name: r.name,
      method: r.method,
      latency: r.latency,
      status: r.status,
      success: r.success,
      error: r.error,
    })),
  };

  try {
    writeFileSync(resolve(process.cwd(), config.jsonPath), JSON.stringify(jsonReport, null, 2), "utf-8");
    console.log(`JSON raw log saved to:    ${colors.bright}${config.jsonPath}${colors.reset}\n`);
  } catch (err: any) {
    console.error(`${colors.red}Failed to write JSON raw log: ${err.message}${colors.reset}`);
  }

  if (alerts.length > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Load test failed unexpectedly: ${err.message || err}${colors.reset}`);
  process.exit(1);
});
