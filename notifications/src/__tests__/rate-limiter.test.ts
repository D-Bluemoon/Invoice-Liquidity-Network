process.env.NOTIFICATIONS_RPC_URL = "http://localhost:8000";
process.env.NOTIFICATIONS_CONTRACT_ID = "GTESTCONTRACT";
process.env.NOTIFICATIONS_NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
process.env.RESEND_API_KEY = "test-api-key";

import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import Database from "better-sqlite3";
import { createApp } from "../api";
import { createDb, setDb } from "../db";
import { RateLimiter } from "../rate-limiter";

describe("RateLimiter unit", () => {
  it("allows requests within the limit", () => {
    const rl = new RateLimiter({ perUserLimit: 3, perChannelLimit: 10, windowMs: 60_000 });
    const r1 = rl.check("user1", "email");
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = rl.check("user1", "email");
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);
  });

  it("blocks when per-user limit is exceeded", () => {
    const rl = new RateLimiter({ perUserLimit: 2, perChannelLimit: 100, windowMs: 60_000 });
    rl.check("user1", "email");
    rl.check("user1", "email");
    const r = rl.check("user1", "email");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("blocks when per-channel limit is exceeded", () => {
    const rl = new RateLimiter({ perUserLimit: 100, perChannelLimit: 2, windowMs: 60_000 });
    rl.check("user1", "webhook");
    rl.check("user2", "webhook");
    const r = rl.check("user3", "webhook");
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it("tracks different users independently", () => {
    const rl = new RateLimiter({ perUserLimit: 2, perChannelLimit: 100, windowMs: 60_000 });
    rl.check("userA", "email");
    rl.check("userA", "email");
    const blocked = rl.check("userA", "email");
    expect(blocked.allowed).toBe(false);

    const other = rl.check("userB", "email");
    expect(other.allowed).toBe(true);
  });

  it("sets limit and resetAt in result", () => {
    const rl = new RateLimiter({ perUserLimit: 5, perChannelLimit: 10, windowMs: 60_000 });
    const r = rl.check("user1", "email");
    expect(r.limit).toBe(5);
    expect(typeof r.resetAt).toBe("number");
    expect(r.resetAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it("resets a user bucket", () => {
    const rl = new RateLimiter({ perUserLimit: 1, perChannelLimit: 100, windowMs: 60_000 });
    rl.check("user1", "email");
    const blocked = rl.check("user1", "email");
    expect(blocked.allowed).toBe(false);

    rl.reset("user1");
    const after = rl.check("user1", "email");
    expect(after.allowed).toBe(true);
  });
});

describe("Rate limit headers and 429 response in API", () => {
  let db: InstanceType<typeof Database>;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    // Use very small limits so tests can exercise 429 without many requests.
    process.env.RATE_LIMIT_PER_USER = "2";
    process.env.RATE_LIMIT_PER_CHANNEL = "100";
    process.env.RATE_LIMIT_WINDOW_MS = "60000";

    db = createDb(":memory:");
    setDb(db);
    app = createApp();
  });

  it("includes rate limit headers on /subscribe", async () => {
    const res = await request(app).post("/subscribe").send({
      stellar_address: "GABCD1234",
      channel: "email",
      destination: "user@example.com",
      triggers: ["invoice_funded"],
    });

    expect(res.headers["x-ratelimit-limit"]).toBeDefined();
    expect(res.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(res.headers["x-ratelimit-reset"]).toBeDefined();
    expect(Number(res.headers["x-ratelimit-remaining"])).toBeGreaterThanOrEqual(0);
  });

  it("returns 429 after per-user limit is reached", async () => {
    const addr = "GLIMITUSER";
    const sub = {
      stellar_address: addr,
      channel: "email",
      destination: "limit@example.com",
      triggers: ["invoice_funded"],
    };

    // Exhaust the 2-request limit.
    await request(app).post("/subscribe").send(sub);
    await request(app).post("/subscribe").send({ ...sub, destination: "limit2@example.com" });
    const res = await request(app).post("/subscribe").send({ ...sub, destination: "limit3@example.com" });

    expect(res.status).toBe(429);
    expect(res.body.error).toMatch(/rate limit/i);
    expect(res.body.retryAfter).toBeTypeOf("number");
  });
});
