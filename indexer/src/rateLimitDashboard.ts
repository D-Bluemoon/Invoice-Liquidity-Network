/**
 * Rate Limit Dashboard (#503)
 *
 * Tracks rate-limit metrics alongside the existing `dashboard.ts` metrics:
 *   - Total allowed / blocked request counts
 *   - Per-IP request counts (top N IPs)
 *   - Time-series buckets (per-minute rolling window)
 *   - Alert thresholds with configurable callbacks
 *
 * Wire it up in api.ts by replacing `createApiRateLimiter()` with
 * `createTrackedRateLimiter()` and exposing `/dashboard/rate-limits`.
 *
 * Usage in api.ts (add after the existing imports):
 *   import { createTrackedRateLimiter, getRateLimitMetrics } from "./rateLimitDashboard";
 *   app.use(createTrackedRateLimiter());
 *   router.get("/dashboard/rate-limits", (_req, res) => res.json(getRateLimitMetrics()));
 */

import type { Request, Response, NextFunction, RequestHandler } from "express";
import { createApiRateLimiter } from "./rateLimit";

// ── Types ──────────────────────────────────────────────────────────────────

export interface RateLimitMetrics {
  totalRequests: number;
  allowedRequests: number;
  blockedRequests: number;
  blockRate: number;
  topIPs: IpEntry[];
  timeSeries: TimeSeriesBucket[];
  alerts: AlertRecord[];
  windowMs: number;
  windowLabel: string;
  collectedSince: string;
}

export interface IpEntry {
  ip: string;
  total: number;
  blocked: number;
  allowed: number;
}

export interface TimeSeriesBucket {
  minuteLabel: string;
  allowed: number;
  blocked: number;
  total: number;
}

export interface AlertRecord {
  triggeredAt: string;
  type: "high_block_rate" | "high_request_volume";
  detail: string;
}

export interface RateLimitAlertConfig {
  /** Block-rate fraction (0–1) that triggers a HIGH_BLOCK_RATE alert. Default 0.25. */
  blockRateThreshold?: number;
  /** Requests-per-minute count that triggers a HIGH_REQUEST_VOLUME alert. Default 80. */
  requestsPerMinuteThreshold?: number;
  /** Called whenever a threshold is exceeded. */
  onAlert?: (alert: AlertRecord) => void;
}

// ── In-memory state ────────────────────────────────────────────────────────

let totalRequests = 0;
let allowedRequests = 0;
let blockedRequests = 0;
let collectedSince = new Date().toISOString();

const ipCounters = new Map<string, { total: number; blocked: number }>();

const TIME_SERIES_WINDOW = 60;
const timeSeries: Map<string, { allowed: number; blocked: number }> = new Map();

const alerts: AlertRecord[] = [];
const MAX_ALERTS = 100;

let alertConfig: RateLimitAlertConfig = {};

// ── Helpers ────────────────────────────────────────────────────────────────

function minuteKey(nowMs = Date.now()): string {
  const d = new Date(nowMs);
  return `${d.toISOString().slice(0, 16)}`;
}

function pruneTimeSeries(): void {
  const keys = Array.from(timeSeries.keys()).sort();
  while (keys.length > TIME_SERIES_WINDOW) {
    timeSeries.delete(keys.shift()!);
  }
}

function normalizeIp(ip: string | undefined): string {
  if (!ip) return "unknown";
  if (ip.startsWith("::ffff:")) return ip.slice(7);
  if (ip === "::1") return "127.0.0.1";
  return ip;
}

function recordHit(ip: string, blocked: boolean): void {
  totalRequests++;
  if (blocked) blockedRequests++;
  else allowedRequests++;

  const normalized = normalizeIp(ip);
  const existing = ipCounters.get(normalized) ?? { total: 0, blocked: 0 };
  existing.total++;
  if (blocked) existing.blocked++;
  ipCounters.set(normalized, existing);

  const key = minuteKey();
  const bucket = timeSeries.get(key) ?? { allowed: 0, blocked: 0 };
  if (blocked) bucket.blocked++;
  else bucket.allowed++;
  timeSeries.set(key, bucket);
  pruneTimeSeries();

  checkAlerts(normalized, key);
}

function checkAlerts(ip: string, currentMinute: string): void {
  const threshold = alertConfig.blockRateThreshold ?? 0.25;
  const volumeThreshold = alertConfig.requestsPerMinuteThreshold ?? 80;

  // Block-rate alert (rolling aggregate)
  if (totalRequests > 20) {
    const rate = blockedRequests / totalRequests;
    if (rate >= threshold) {
      emitAlert({
        type: "high_block_rate",
        detail: `Block rate ${(rate * 100).toFixed(1)}% exceeds ${(threshold * 100).toFixed(0)}% threshold (${blockedRequests}/${totalRequests} requests blocked)`,
      });
    }
  }

  // Per-minute volume alert
  const bucket = timeSeries.get(currentMinute);
  if (bucket) {
    const minuteTotal = bucket.allowed + bucket.blocked;
    if (minuteTotal >= volumeThreshold) {
      emitAlert({
        type: "high_request_volume",
        detail: `${minuteTotal} requests in minute ${currentMinute} exceeds threshold of ${volumeThreshold}`,
      });
    }
  }
}

let lastAlertKey = "";

function emitAlert(payload: Omit<AlertRecord, "triggeredAt">): void {
  // Deduplicate: don't fire the same alert type within the same minute
  const dedupeKey = `${minuteKey()}:${payload.type}`;
  if (dedupeKey === lastAlertKey) return;
  lastAlertKey = dedupeKey;

  const alert: AlertRecord = {
    triggeredAt: new Date().toISOString(),
    ...payload,
  };

  alerts.unshift(alert);
  if (alerts.length > MAX_ALERTS) alerts.length = MAX_ALERTS;

  alertConfig.onAlert?.(alert);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function configureRateLimitAlerts(config: RateLimitAlertConfig): void {
  alertConfig = config;
}

export function getRateLimitMetrics(topN = 10): RateLimitMetrics {
  const topIPs: IpEntry[] = Array.from(ipCounters.entries())
    .map(([ip, c]) => ({ ip, total: c.total, blocked: c.blocked, allowed: c.total - c.blocked }))
    .sort((a, b) => b.total - a.total)
    .slice(0, topN);

  const timeSerisList: TimeSeriesBucket[] = Array.from(timeSeries.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([minuteLabel, b]) => ({
      minuteLabel,
      allowed: b.allowed,
      blocked: b.blocked,
      total: b.allowed + b.blocked,
    }));

  return {
    totalRequests,
    allowedRequests,
    blockedRequests,
    blockRate: totalRequests > 0 ? blockedRequests / totalRequests : 0,
    topIPs,
    timeSeries: timeSerisList,
    alerts: [...alerts],
    windowMs: TIME_SERIES_WINDOW * 60_000,
    windowLabel: `${TIME_SERIES_WINDOW}min rolling`,
    collectedSince,
  };
}

export function resetRateLimitMetrics(): void {
  totalRequests = 0;
  allowedRequests = 0;
  blockedRequests = 0;
  ipCounters.clear();
  timeSeries.clear();
  alerts.length = 0;
  collectedSince = new Date().toISOString();
}

// ── Middleware ─────────────────────────────────────────────────────────────

/**
 * Returns a pair of middlewares:
 *  1. The standard rate limiter (from rateLimit.ts) — must run first so the
 *     response status is set before we check it.
 *  2. A post-response tracker that records allowed/blocked counts.
 *
 * Mount both in order:
 *   const [limiter, tracker] = createTrackedRateLimiter();
 *   app.use(limiter);
 *   app.use(tracker);
 */
export function createTrackedRateLimiter(): [RequestHandler, RequestHandler] {
  const limiter = createApiRateLimiter();

  const tracker: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    res.on("finish", () => {
      const blocked = res.statusCode === 429;
      recordHit(req.ip ?? "", blocked);
    });
    next();
  };

  return [limiter, tracker];
}

/**
 * Express route handler for `GET /dashboard/rate-limits`.
 * Plug directly into an Express router:
 *
 *   router.get("/dashboard/rate-limits", rateLimitDashboardHandler);
 */
export const rateLimitDashboardHandler: RequestHandler = (_req: Request, res: Response) => {
  const topN = typeof _req.query.topN === "string" ? Math.min(parseInt(_req.query.topN, 10) || 10, 100) : 10;
  res.json(getRateLimitMetrics(topN));
};
