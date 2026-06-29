import express, { Request, Response, Router, RequestHandler } from "express";
import swaggerUi from "swagger-ui-express";
import {
  getDb,
  getFreelancerStats,
  getInvoiceById,
  getInvoiceHistory,
  getLPStats,
  getProtocolStats,
  getTopLPs,
  queryInvoicesPaginated,
  getCursorUpdatedAt,
} from "./db";
import { cacheGet, cacheSet } from "./cache";
import { openApiSpec } from "./openapi";
import { createGraphQLHandler } from "./graphql";
import { createApiRateLimiter } from "./rateLimit";
import {
  getArchiveStats,
  queryArchiveInvoices,
  queryArchiveEvents,
  restoreInvoice,
  archiveOldData,
} from "./archive";
import { getDashboardMetrics, recordRequest, recordError } from "./dashboard";
import { BackupManager } from "./backup";

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

  // ── GraphQL (queries, mutations, subscriptions via SSE + GraphiQL) ──────────
  const yoga = createGraphQLHandler();
  app.use(yoga.graphqlEndpoint, yoga);

  // ── Swagger / OpenAPI docs ─────────────────────────────────────────────────
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: "ILN Indexer API Docs",
    swaggerOptions: { defaultModelsExpandDepth: -1 },
  }));

  const startTime = Date.now();
  const backupManager = new BackupManager();

  // ── Version negotiation ────────────────────────────────────────────────────
  // If the client sends Accept: application/vnd.iln.v1+json or API-Version: 1
  // we echo back API-Version: 1 so callers can detect which version served them.
  const versionNegotiate: RequestHandler = (req, res, next) => {
    const accept = req.get("Accept") ?? "";
    const apiVersion = req.get("API-Version") ?? "";
    if (
      (accept.includes("application/vnd.iln.v1+json") || apiVersion === "1") &&
      !req.path.startsWith("/v1")
    ) {
      res.setHeader("API-Version", "1");
    }
    next();
  };

  const addV1Headers: RequestHandler = (_req, res, next) => {
    res.setHeader("API-Version", "1");
    next();
  };

  // Unversioned routes are kept for backward compat but carry deprecation signals.
  const addDeprecationHeaders: RequestHandler = (_req, res, next) => {
    res.setHeader("Deprecation", "true");
    res.setHeader("Sunset", "Sat, 01 Jan 2026 00:00:00 GMT");
    next();
  };

  const trackMetrics: RequestHandler = (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      recordRequest(duration);
      if (res.statusCode >= 400) {
        recordError(`${res.statusCode}`, `${req.method} ${req.path} returned ${res.statusCode}`);
      }
    });
    next();
  };

  // ── Shared route handlers ──────────────────────────────────────────────────
  const router = Router();

  // GET /health
  router.get("/health", (_req: Request, res: Response) => {
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

  // GET /invoices
  // Supported query parameters (all optional, ANDed together):
  //   ?status=Pending|Funded|Paid|Defaulted
  //   ?freelancer=G...
  //   ?payer=G...
  //   ?funder=G...
  //   ?limit=10 (default 100 max) & ?cursor=opaque
  router.get("/invoices", async (req: Request, res: Response) => {
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

  router.get("/stats", (_req: Request, res: Response) => {
    res.json(getProtocolStats());
  });

  router.get("/lps/top", (req: Request, res: Response) => {
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

  router.get("/lps/:address/stats", (req: Request, res: Response) => {
    res.json(getLPStats(req.params.address));
  });

  router.get("/freelancers/:address/stats", (req: Request, res: Response) => {
    res.json(getFreelancerStats(req.params.address));
  });

  router.get("/history/:address", (req: Request, res: Response) => {
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

  // GET /invoice/:id
  router.get("/invoice/:id", async (req: Request, res: Response) => {
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

  // GET /dashboard
  router.get("/dashboard", (_req: Request, res: Response) => {
    res.json(getDashboardMetrics());
  });

  // GET /archive/stats
  router.get("/archive/stats", (_req: Request, res: Response) => {
    res.json(getArchiveStats());
  });

  // GET /archive/invoices
  router.get("/archive/invoices", (req: Request, res: Response) => {
    const { status, freelancer, payer, funder } = req.query;
    const filter = {
      status: typeof status === "string" ? status : undefined,
      freelancer: typeof freelancer === "string" ? freelancer : undefined,
      payer: typeof payer === "string" ? payer : undefined,
      funder: typeof funder === "string" ? funder : undefined,
    };
    res.json({ invoices: queryArchiveInvoices(filter) });
  });

  // GET /archive/events
  router.get("/archive/events", (req: Request, res: Response) => {
    const invoiceId = typeof req.query.invoiceId === "string" ? parseInt(req.query.invoiceId, 10) : undefined;
    res.json({ events: queryArchiveEvents(invoiceId !== undefined && isNaN(invoiceId) ? undefined : invoiceId) });
  });

  // POST /archive/restore/:id
  router.post("/archive/restore/:id", (req: Request, res: Response) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ error: "Invalid invoice ID - must be a positive integer" });
      return;
    }
    const success = restoreInvoice(id);
    if (!success) {
      res.status(404).json({ error: `Invoice #${id} not found in archive` });
      return;
    }
    res.json({ success: true, message: `Invoice #${id} and associated events restored successfully` });
  });

  // POST /archive/run
  router.post("/archive/run", (req: Request, res: Response) => {
    const olderThanDays = typeof req.body?.olderThanDays === "number" ? req.body.olderThanDays : 90;
    try {
      const result = archiveOldData(olderThanDays);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Archival run failed" });
    }
  });

  // ── Backup endpoints ──────────────────────────────────────────────────────

  // POST /backup — trigger a manual backup
  app.post("/backup", async (_req: Request, res: Response) => {
    try {
      const manifest = await backupManager.runBackup();
      if (manifest) {
        res.json({ success: true, backup: manifest });
      } else {
        res.status(500).json({ success: false, error: "Backup failed" });
      }
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  });

  // GET /backup — list all available backups
  app.get("/backup", (_req: Request, res: Response) => {
    const backups = backupManager.listBackups();
    res.json({ backups, total: backups.length });
  });

  // GET /backup/latest — get the latest backup manifest
  app.get("/backup/latest", (_req: Request, res: Response) => {
    const latest = backupManager.getLatestBackup();
    if (latest) {
      res.json(latest);
    } else {
      res.status(404).json({ error: "No backups found" });
    }
  });

  // POST /backup/restore — restore from a backup
  app.post("/backup/restore", async (req: Request, res: Response) => {
    const { backupPath, verify } = req.body;

    if (!backupPath || typeof backupPath !== "string") {
      res.status(400).json({ error: "backupPath is required" });
      return;
    }

    try {
      await backupManager.restore({ backupPath, verify: verify !== false });
      res.json({ success: true, message: "Restore complete" });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err instanceof Error ? err.message : "Restore failed",
      });
    }
  });

  // Catch-all 404 inside the router so a missing /v1/* route doesn't fall
  // through to the root mount and get processed a second time.
  router.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Mount routes ───────────────────────────────────────────────────────────
  app.use(trackMetrics);
  app.use(versionNegotiate);
  app.use("/v1", addV1Headers, router);
  app.use(addDeprecationHeaders, router);

  return app;
}
