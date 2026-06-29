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

  app.post("/backup", async (_req: Request, res: Response) => {
    try {
      const manifest = await backupManager.runBackup();
      if (manifest) {
        res.json({ success: true, backup: manifest });
      } try {                                          // ⚠️ line 74 — this looks broken
      invoicesUpsertedTotal.inc();
    } catch {}
    pubsub.publish(INVOICE_UPDATED, { invoiceUpdated: invoice, trigger...
    pubsub.publish(EVENT_STREAM, { eventStream: ilnEvent });
    if (eventType === "submitted") {
      pubSub.publish("INVOICE_CREATED", invoice);
    } else {
      pubSub.publish("INVOICE_UPDATED", invoice);
    }
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