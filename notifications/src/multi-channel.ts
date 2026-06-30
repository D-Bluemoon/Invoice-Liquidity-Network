/**
 * Multi-Channel Delivery (#506)
 *
 * Delivers a notification payload across multiple channels simultaneously
 * (email, SMS, WebSocket, webhook). Tracks per-channel delivery status,
 * supports a fallback chain on failure, and exposes in-memory analytics.
 *
 * Usage:
 *   const delivery = new MultiChannelDelivery(adapters, channels);
 *   const report = await delivery.deliver(payload, userChannelConfig);
 */

import type { NotificationPayload, SubscriptionChannel } from "./types";

// ── Channel adapters (injectable for testing) ─────────────────────────────

export interface EmailAdapter {
  send(to: string, subject: string, body: string): Promise<void>;
}

export interface SmsAdapter {
  send(to: string, body: string): Promise<void>;
}

export interface WebSocketAdapter {
  broadcast(address: string, payload: unknown): Promise<void>;
}

export interface WebhookAdapter {
  post(url: string, payload: unknown): Promise<{ status: number }>;
}

export interface ChannelAdapters {
  email?: EmailAdapter;
  sms?: SmsAdapter;
  websocket?: WebSocketAdapter;
  webhook?: WebhookAdapter;
}

// ── Per-user channel configuration ────────────────────────────────────────

export interface UserChannelConfig {
  /** Channels to attempt, in priority order. */
  channels: SubscriptionChannel[];
  /**
   * Fallback channels tried if all primary channels fail.
   * If empty, no fallback is attempted.
   */
  fallbackChannels?: SubscriptionChannel[];
  email?: string;
  phone?: string;
  webhookUrl?: string;
  stellarAddress?: string;
}

// ── Delivery results ───────────────────────────────────────────────────────

export type DeliveryStatus = "sent" | "failed" | "skipped" | "no_adapter";

export interface ChannelDeliveryResult {
  channel: SubscriptionChannel;
  status: DeliveryStatus;
  durationMs: number;
  error?: string;
  isFallback: boolean;
}

export interface MultiChannelDeliveryReport {
  overallSuccess: boolean;
  results: ChannelDeliveryResult[];
  sentAt: number;
  primaryAttempted: SubscriptionChannel[];
  fallbackAttempted: SubscriptionChannel[];
}

// ── Analytics store ────────────────────────────────────────────────────────

export interface ChannelAnalytics {
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalDurationMs: number;
  avgDurationMs: number;
}

const analyticsStore = new Map<SubscriptionChannel, ChannelAnalytics>();

function getOrInitAnalytics(channel: SubscriptionChannel): ChannelAnalytics {
  if (!analyticsStore.has(channel)) {
    analyticsStore.set(channel, {
      attempted: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      totalDurationMs: 0,
      avgDurationMs: 0,
    });
  }
  return analyticsStore.get(channel)!;
}

function recordAnalytic(channel: SubscriptionChannel, result: ChannelDeliveryResult): void {
  const a = getOrInitAnalytics(channel);
  a.attempted++;
  a.totalDurationMs += result.durationMs;
  a.avgDurationMs = a.totalDurationMs / a.attempted;

  if (result.status === "sent") a.succeeded++;
  else if (result.status === "failed") a.failed++;
  else if (result.status === "skipped") a.skipped++;
}

export function getChannelAnalytics(): Record<SubscriptionChannel, ChannelAnalytics> {
  return Object.fromEntries(analyticsStore) as Record<SubscriptionChannel, ChannelAnalytics>;
}

export function resetChannelAnalytics(): void {
  analyticsStore.clear();
}

// ── MultiChannelDelivery ───────────────────────────────────────────────────

export class MultiChannelDelivery {
  constructor(private readonly adapters: ChannelAdapters) {}

  /**
   * Attempt delivery across all configured channels simultaneously.
   * If ALL primary channels fail, the fallback chain is tried sequentially
   * until one succeeds.
   */
  async deliver(
    payload: NotificationPayload,
    config: UserChannelConfig,
  ): Promise<MultiChannelDeliveryReport> {
    const primaryResults = await Promise.all(
      config.channels.map((ch) => this.deliverToChannel(ch, payload, config, false)),
    );

    const anyPrimarySuccess = primaryResults.some((r) => r.status === "sent");

    let fallbackResults: ChannelDeliveryResult[] = [];
    if (!anyPrimarySuccess && config.fallbackChannels?.length) {
      fallbackResults = await this.runFallbackChain(
        config.fallbackChannels,
        payload,
        config,
      );
    }

    const allResults = [...primaryResults, ...fallbackResults];
    const overallSuccess = allResults.some((r) => r.status === "sent");

    for (const r of allResults) recordAnalytic(r.channel, r);

    return {
      overallSuccess,
      results: allResults,
      sentAt: Date.now(),
      primaryAttempted: config.channels,
      fallbackAttempted: config.fallbackChannels ?? [],
    };
  }

  /** Run fallback channels sequentially, stopping on first success. */
  private async runFallbackChain(
    fallbacks: SubscriptionChannel[],
    payload: NotificationPayload,
    config: UserChannelConfig,
  ): Promise<ChannelDeliveryResult[]> {
    const results: ChannelDeliveryResult[] = [];
    for (const ch of fallbacks) {
      const r = await this.deliverToChannel(ch, payload, config, true);
      results.push(r);
      if (r.status === "sent") break;
    }
    return results;
  }

  private async deliverToChannel(
    channel: SubscriptionChannel,
    payload: NotificationPayload,
    config: UserChannelConfig,
    isFallback: boolean,
  ): Promise<ChannelDeliveryResult> {
    const start = Date.now();

    try {
      const status = await this.dispatchChannel(channel, payload, config);
      return {
        channel,
        status,
        durationMs: Date.now() - start,
        isFallback,
      };
    } catch (err: any) {
      return {
        channel,
        status: "failed",
        durationMs: Date.now() - start,
        error: err?.message ?? String(err),
        isFallback,
      };
    }
  }

  private async dispatchChannel(
    channel: SubscriptionChannel,
    payload: NotificationPayload,
    config: UserChannelConfig,
  ): Promise<DeliveryStatus> {
    switch (channel) {
      case "email": {
        if (!this.adapters.email) return "no_adapter";
        if (!config.email) return "skipped";
        await this.adapters.email.send(config.email, payload.subject, payload.message);
        return "sent";
      }

      case "sms": {
        if (!this.adapters.sms) return "no_adapter";
        if (!config.phone) return "skipped";
        const smsBody = [
          payload.subject,
          `Invoice #${payload.invoice.id} — ${payload.invoice.status}`,
        ].join("\n");
        await this.adapters.sms.send(config.phone, smsBody);
        return "sent";
      }

      case "websocket": {
        if (!this.adapters.websocket) return "no_adapter";
        if (!config.stellarAddress) return "skipped";
        await this.adapters.websocket.broadcast(config.stellarAddress, {
          trigger: payload.trigger,
          invoiceId: payload.invoice.id,
          status: payload.invoice.status,
          subject: payload.subject,
          message: payload.message,
          actor: payload.actor,
          eventId: payload.eventId ?? null,
        });
        return "sent";
      }

      case "webhook": {
        if (!this.adapters.webhook) return "no_adapter";
        if (!config.webhookUrl) return "skipped";
        const resp = await this.adapters.webhook.post(config.webhookUrl, {
          trigger: payload.trigger,
          actor: payload.actor,
          invoice: payload.invoice,
          subject: payload.subject,
          message: payload.message,
          eventId: payload.eventId ?? null,
          eventType: payload.eventType ?? null,
        });
        if (resp.status < 200 || resp.status >= 300) {
          throw new Error(`Webhook returned HTTP ${resp.status}`);
        }
        return "sent";
      }

      default:
        return "skipped";
    }
  }
}

// ── Delivery status summary helpers ───────────────────────────────────────

export function reportSummary(report: MultiChannelDeliveryReport): string {
  const sent = report.results.filter((r) => r.status === "sent").map((r) => r.channel);
  const failed = report.results.filter((r) => r.status === "failed").map((r) => r.channel);
  return [
    `overall=${report.overallSuccess ? "OK" : "FAIL"}`,
    sent.length ? `sent=[${sent.join(",")}]` : null,
    failed.length ? `failed=[${failed.join(",")}]` : null,
  ]
    .filter(Boolean)
    .join(" ");
}
