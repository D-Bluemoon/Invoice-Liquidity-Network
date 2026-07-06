import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendSms, deliverNotification } from "../src/delivery";

vi.mock("twilio", () => {
  const mockCreate = vi.fn().mockResolvedValue({ sid: "SM123", status: "queued" });
  return {
    default: vi.fn(() => ({
      messages: { create: mockCreate },
    })),
  };
});

vi.mock("resend", () => ({
  Resend: vi.fn(() => ({
    emails: { send: vi.fn().mockResolvedValue({}) },
  })),
}));

vi.mock("./config", () => ({
  CONFIG: {
    resendApiKey: "test-key",
    resendFromEmail: "test@example.com",
    twilioAccountSid: "AC123",
    twilioAuthToken: "auth-token",
    twilioFromNumber: "+15551234567",
  },
}));

function makeSubscription(overrides: Record<string, any> = {}) {
  return {
    id: 1,
    stellar_address: "GTEST",
    channel: "sms" as const,
    destination: "+15559876543",
    triggers: ["invoice_funded" as const],
    created_at: Date.now(),
    ...overrides,
  };
}

function makePayload(overrides: Record<string, any> = {}) {
  return {
    trigger: "invoice_funded" as const,
    invoice: {
      id: 42,
      freelancer: "GFREELANCER",
      payer: "GPAYER",
      amount: "100000000",
      due_date: Math.floor(Date.now() / 1000) + 86400,
      discount_rate: 300,
      status: "Funded" as const,
      funder: null,
      funded_at: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    recipientAddress: "GTEST",
    subject: "Invoice #42 funded",
    message: "Your invoice has been funded",
    actor: "freelancer" as const,
    ...overrides,
  };
}

describe("sendSms", () => {
  it("sends SMS via Twilio with correct parameters", async () => {
    const Twilio = (await import("twilio")).default;
    const mockTwilio = Twilio as unknown as ReturnType<typeof vi.fn>;

    const sub = makeSubscription();
    const payload = makePayload();

    await sendSms(sub, payload);

    expect(mockTwilio).toHaveBeenCalledWith("AC123", "auth-token");
    const client = mockTwilio.mock.results[0].value;
    expect(client.messages.create).toHaveBeenCalledWith({
      to: "+15559876543",
      from: "+15551234567",
      body: expect.stringContaining("Invoice #42"),
    });
  });

  it("throws when Twilio credentials are not configured", async () => {
    const { CONFIG } = await import("./config");
    const originalSid = CONFIG.twilioAccountSid;
    (CONFIG as any).twilioAccountSid = "";

    const sub = makeSubscription();
    const payload = makePayload();

    await expect(sendSms(sub, payload)).rejects.toThrow("Twilio credentials not configured");

    (CONFIG as any).twilioAccountSid = originalSid;
  });
});

describe("deliverNotification SMS channel", () => {
  it("routes SMS channel to sendSms", async () => {
    const Twilio = (await import("twilio")).default;
    const mockTwilio = Twilio as unknown as ReturnType<typeof vi.fn>;

    const sub = makeSubscription({ channel: "sms" });
    const payload = makePayload();

    await deliverNotification(sub, payload);

    const client = mockTwilio.mock.results[0].value;
    expect(client.messages.create).toHaveBeenCalled();
  });
});
