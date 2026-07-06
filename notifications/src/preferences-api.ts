/**
 * Express router for notification preference endpoints.
 *
 * Mount on the main notification app:
 *   app.use("/preferences", createPreferencesRouter());
 *
 * Routes
 * ──────
 *   GET    /preferences/:address   fetch current preferences (returns defaults if never set)
 *   PUT    /preferences/:address   replace all preferences
 *   PATCH  /preferences/:address   partial update
 *   DELETE /preferences/:address   reset to defaults
 */

import { Router, type Request, type Response } from "express";
import { preferencesService } from "./preferences";
import type {
  NotificationFrequency,
  QuietHours,
  TriggerPreference,
} from "./preferences";
import type { SubscriptionChannel, NotificationTrigger } from "./types";

// ── Validation helpers ─────────────────────────────────────────────────────

const VALID_CHANNELS: SubscriptionChannel[] = ["email", "sms", "webhook", "websocket"];
const VALID_FREQUENCIES: NotificationFrequency[] = ["realtime", "daily", "weekly"];
const VALID_TRIGGERS: NotificationTrigger[] = [
  "invoice_funded",
  "invoice_paid",
  "invoice_defaulted",
  "invoice_due_soon",
  "invoice_overdue",
];

function isValidChannels(v: unknown): v is SubscriptionChannel[] {
  return Array.isArray(v) && v.every((c) => VALID_CHANNELS.includes(c as SubscriptionChannel));
}

function isValidFrequency(v: unknown): v is NotificationFrequency {
  return VALID_FREQUENCIES.includes(v as NotificationFrequency);
}

function isValidQuietHours(v: unknown): v is QuietHours | null {
  if (v === null) return true;
  if (typeof v !== "object" || v === null) return false;
  const q = v as Record<string, unknown>;
  return (
    typeof q.startHour === "number" &&
    q.startHour >= 0 &&
    q.startHour <= 23 &&
    typeof q.endHour === "number" &&
    q.endHour >= 0 &&
    q.endHour <= 23 &&
    typeof q.timezone === "string" &&
    q.timezone.length > 0
  );
}

function isValidTriggerPreferences(v: unknown): v is TriggerPreference[] {
  if (!Array.isArray(v)) return false;
  return v.every((item) => {
    if (typeof item !== "object" || item === null) return false;
    const p = item as Record<string, unknown>;
    return (
      VALID_TRIGGERS.includes(p.trigger as NotificationTrigger) &&
      typeof p.enabled === "boolean" &&
      isValidChannels(p.channels)
    );
  });
}

function reject(res: Response, msg: string): Response {
  return res.status(400).json({ error: msg });
}

// ── Router ─────────────────────────────────────────────────────────────────

export function createPreferencesRouter(): Router {
  const router = Router();

  // GET /preferences/:address
  router.get("/:address", (req: Request, res: Response) => {
    const prefs = preferencesService.get(req.params.address);
    res.json({ preferences: prefs });
  });

  // PUT /preferences/:address — full replacement
  router.put("/:address", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const {
      enabledChannels,
      frequency,
      quietHours = null,
      triggerPreferences = [],
    } = body;

    if (!isValidChannels(enabledChannels))
      return reject(res, `enabledChannels must be an array of: ${VALID_CHANNELS.join(", ")}`);
    if (!isValidFrequency(frequency))
      return reject(res, `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`);
    if (!isValidQuietHours(quietHours))
      return reject(res, "quietHours must be null or { startHour, endHour, timezone }");
    if (!isValidTriggerPreferences(triggerPreferences))
      return reject(res, "triggerPreferences must be an array of { trigger, enabled, channels }");

    const updated = preferencesService.upsert(req.params.address, {
      enabledChannels,
      frequency,
      quietHours: quietHours as QuietHours | null,
      triggerPreferences: triggerPreferences as TriggerPreference[],
    });
    res.json({ preferences: updated });
  });

  // PATCH /preferences/:address — partial update
  router.patch("/:address", (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const patch: Parameters<typeof preferencesService.upsert>[1] = {};

    if ("enabledChannels" in body) {
      if (!isValidChannels(body.enabledChannels))
        return reject(res, `enabledChannels must be an array of: ${VALID_CHANNELS.join(", ")}`);
      patch.enabledChannels = body.enabledChannels as SubscriptionChannel[];
    }

    if ("frequency" in body) {
      if (!isValidFrequency(body.frequency))
        return reject(res, `frequency must be one of: ${VALID_FREQUENCIES.join(", ")}`);
      patch.frequency = body.frequency as NotificationFrequency;
    }

    if ("quietHours" in body) {
      if (!isValidQuietHours(body.quietHours))
        return reject(res, "quietHours must be null or { startHour, endHour, timezone }");
      patch.quietHours = body.quietHours as QuietHours | null;
    }

    if ("triggerPreferences" in body) {
      if (!isValidTriggerPreferences(body.triggerPreferences))
        return reject(res, "triggerPreferences must be an array of { trigger, enabled, channels }");
      patch.triggerPreferences = body.triggerPreferences as TriggerPreference[];
    }

    const updated = preferencesService.upsert(req.params.address, patch);
    res.json({ preferences: updated });
  });

  // DELETE /preferences/:address — reset to defaults
  router.delete("/:address", (req: Request, res: Response) => {
    preferencesService.delete(req.params.address);
    res.status(204).end();
  });

  return router;
}
