import express, { Request, Response } from "express";
import { registry, httpRequestsTotal, httpRequestDuration, httpErrorsTotal } from "./metrics";
import {
  getDb,
  getFreelancerStats,
  getInvoiceById,
  getInvoiceHistory,
  getLPStats,
  getProtocolStats,
  getTopLPs,
  queryInvoices,
  queryInvoicesPaginated,
  getCursorUpdatedAt,
} from "./db";
import { cacheGet, cacheSet } from "./cache";
import { createApiRateLimiter } from "./rateLimit";

/**
 * Build and return the Express application.
 * Calling this as a factory (rather than exporting a singleton) makes
 * the app trivially injectable in tests.
 */
export function createApp(): express.Application {
  const app = express();
  // Trust the first hop's X-Forwarded-For (e.g. Railway's proxy) so
  // per-IP rate limiting sees real client IPs rather than the proxy's.
  app.set("trust proxy", 1);
  app.use(createApiRateLimiter());
  app.use(express.json());

  // Metrics middleware: count requests, measure duration, and capture errors.
  app.use((req: Request, res: Response, next) => {
    const end = httpRequestDuration.startTimer({ method: req.method, route: req.path });
    res.on("finish", () => {
      const status = String(res.statusCode);
      httpRequestsTotal.inc({ method: req.method, route: req.path, status }, 1);
      end({ status });
      if (res.statusCode >= 500) {
        httpErrorsTotal.inc({ method: req.method, route: req.path, status });
      }
    });
    next();
  });

  const startTime = Date.now();

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get("/health", (_req: Request, res: Response) => {
    let dbStatus: "ok" | "error" = "ok";
    try {
      getDb().prepare("SELECT 1").get();
    } catch {
      dbStatus = "error";
    }

    const lastSyncMs = getCursorUpdatedAt();
    const uptime = Date.now() - startTime;
    const status = dbStatus === "ok" ? "ok" : "degraded";

    res.json({
      status,
      db: dbStatus,
      lastSync: lastSyncMs !== null ? new Date(lastSyncMs).toISOString() : null,
      uptime,
    });
  });

  // ── GET /invoices ──────────────────────────────────────────────────────────
  // Supported query parameters (all optional, ANDed together):
  //   ?status=Pending|Funded|Paid|Defaulted
  //   ?freelancer=G...
  //   ?payer=G...
  //   ?funder=G...
  //   ?limit=10 (default 100 max) & ?cursor=opaque
  app.get("/invoices", async (req: Request, res: Response) => {
    const { status, freelancer, payer, funder, limit: rawLimit, cursor } = req.query;

    const s = typeof status === "string" ? status : "";
    const fl = typeof freelancer === "string" ? freelancer : "";
    const pa = typeof payer === "string" ? payer : "";
    const fu = typeof funder === "string" ? funder : "";
    const limit = typeof rawLimit === "string" ? Math.min(parseInt(rawLimit, 10) || 100, 100) : 100;
    const cacheKey = `invoices:${s}:${fl}:${pa}:${fu}:limit=${limit}:cursor=${cursor ?? ""}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const { invoices, hasMore, nextCursor } = queryInvoicesPaginated(
      {
        status: s || undefined,
        freelancer: fl || undefined,
        payer: pa || undefined,
        funder: fu || undefined,
      },
      limit,
      typeof cursor === "string" ? cursor : undefined,
    );

    const result = { invoices, hasMore, nextCursor };
    await cacheSet(cacheKey, JSON.stringify(result));
    res.json(result);
  });

  app.get("/stats", (_req: Request, res: Response) => {
    res.json(getProtocolStats());
  });

  app.get("/lps/top", (req: Request, res: Response) => {
    const rawLimit =
      typeof req.query.limit === "string" ? Number(req.query.limit) : 10;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 10;
    const period =
      typeof req.query.period === "string" ? req.query.period : "all";

    if (!["all", "week", "month"].includes(period)) {
      res
        .status(400)
        .json({ error: "Invalid period - expected all, week, or month" });
      return;
    }

    res.json(getTopLPs(limit, period));
  });

  app.get("/lps/:address/stats", (req: Request, res: Response) => {
    res.json(getLPStats(req.params.address));
  });

  app.get("/freelancers/:address/stats", (req: Request, res: Response) => {
    res.json(getFreelancerStats(req.params.address));
  });

  app.get("/history/:address", (req: Request, res: Response) => {
    const role =
      typeof req.query.role === "string" ? req.query.role : "freelancer";

    if (role !== "freelancer" && role !== "payer" && role !== "funder") {
      res.status(400).json({
        error: "Invalid role - expected freelancer, payer, or funder",
      });
      return;
    }

    res.json(getInvoiceHistory(req.params.address, role));
  });

  // ── GET /invoice/:id ───────────────────────────────────────────────────────
  app.get("/invoice/:id", async (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id) || id <= 0) {
      res
        .status(400)
        .json({ error: "Invalid invoice ID - must be a positive integer" });
      return;
    }

    const cacheKey = `invoice:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      res.json(JSON.parse(cached));
      return;
    }

    const invoice = getInvoiceById(id);
    if (!invoice) {
      res.status(404).json({ error: `Invoice #${id} not found` });
      return;
    }

    const result = { invoice };
    await cacheSet(cacheKey, JSON.stringify(result));
    res.json(result);
  });

  // ── GET /metrics ─────────────────────────────────────────────────────────
  app.get("/metrics", async (_req: Request, res: Response) => {
    try {
      res.setHeader("Content-Type", registry.contentType);
      const body = await registry.metrics();
      res.send(body);
    } catch (err) {
      res.status(500).send("Error collecting metrics");
    }
  });

  return app;
}
