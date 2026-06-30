import { describe, expect, it } from "vitest";
import { renderEmailTemplate, renderSmsTemplate } from "../src/templates";
import type { NotificationPayload } from "../src/types";

const basePayload: NotificationPayload = {
  trigger: "invoice_funded",
  recipientAddress: "GFREELANCER000000000000000000000000000000000000000000000001",
  subject: "Invoice #321 funded",
  message: "Your invoice #321 has been funded for 500000000 stroops.",
  actor: "freelancer",
  eventType: "funded",
  invoice: {
    id: 321,
    freelancer: "GFREELANCER000000000000000000000000000000000000000000000001",
    payer: "GPAYER00000000000000000000000000000000000000000000000000001",
    amount: "500000000",
    due_date: 1893456000,
    discount_rate: 250,
    status: "Funded",
    funder: "GLP0000000000000000000000000000000000000000000000000000001",
    funded_at: 1890864000,
    created_at: 1890777600,
    updated_at: 1890864000,
  },
};

function makePayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    ...basePayload,
    ...overrides,
    invoice: {
      ...basePayload.invoice,
      ...overrides.invoice,
    },
  };
}

describe("notification templates", () => {
  it("captures the responsive email template snapshot", () => {
    expect(renderEmailTemplate(basePayload)).toMatchSnapshot();
  });

  it("captures the SMS template snapshot", () => {
    expect(renderSmsTemplate(basePayload)).toMatchSnapshot();
  });

  it("interpolates variables and escapes dynamic HTML values", () => {
    const payload = makePayload({
      subject: 'Invoice <777> & "ready"',
      message: 'Invoice <777> & payout "ready" for <script>alert(1)</script>.',
      recipientAddress: "GRECIPIENT&<>",
      invoice: {
        id: 777,
        amount: "700000000 & bonus",
        freelancer: "GFREELANCER&<>",
        payer: 'GPAYER"QUOTE',
        status: "Paid",
        funder: null,
      },
    });

    const email = renderEmailTemplate(payload);
    const sms = renderSmsTemplate(payload);

    expect(email.subject).toBe('Invoice <777> & "ready"');
    expect(email.html).toContain("Invoice &lt;777&gt; &amp; &quot;ready&quot;");
    expect(email.html).toContain("700000000 &amp; bonus");
    expect(email.html).toContain("GFREELANCER&amp;&lt;&gt;");
    expect(email.html).toContain("GPAYER&quot;QUOTE");
    expect(email.html).toContain("GRECIPIENT&amp;&lt;&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("GFREELANCER&<>");

    expect(sms).toContain("Invoice #777");
    expect(sms).toContain("Status: Paid");
    expect(sms).toContain("Amount: 700000000 & bonus");
  });

  it("includes responsive email rules for narrow clients", () => {
    const { html } = renderEmailTemplate(basePayload);

    expect(html).toContain('name="viewport" content="width=device-width, initial-scale=1.0"');
    expect(html).toContain("@media only screen and (max-width: 600px)");
    expect(html).toContain(".container { width: 100% !important; }");
    expect(html).toContain(".content { padding: 24px 16px !important; }");
    expect(html).toContain('class="container" width="600"');
    expect(html).toContain('width="100%"');
  });

  it("uses cross-client-safe email markup", () => {
    const { html } = renderEmailTemplate(basePayload);

    expect(html).toContain('<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"');
    expect(html).toContain('cellspacing="0" cellpadding="0" border="0"');
    expect(html).not.toMatch(/display:\s*(flex|grid)/i);
    expect(html).not.toMatch(/position:\s*(fixed|sticky)/i);
    expect(html).not.toContain("<script");
    expect(html).not.toMatch(/var\(--/);
  });

  it("passes static accessibility checks", () => {
    const { html } = renderEmailTemplate(basePayload);
    const images = html.match(/<img\b[^>]*>/g) ?? [];

    expect(html).toContain('<html lang="en">');
    expect(html).toContain("<title>Invoice #321 funded</title>");
    expect(html).toMatch(/<h1[^>]*>Invoice #321 funded<\/h1>/);
    expect(html).toContain('role="article"');
    expect(html).toContain('aria-roledescription="email"');
    expect(html).toContain('aria-label="Invoice details"');
    expect(html).toMatch(/<span class="preheader"[^>]*>Your invoice #321 has been funded/);
    expect(html).toMatch(/color:\s*#[0-9a-f]{6}/i);
    expect(html).toMatch(/background-color:\s*#[0-9a-f]{6}/i);
    expect(images.every((image) => /\salt=/.test(image))).toBe(true);
  });
});
