import type { NotificationPayload } from "./types";

export interface RenderedEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const ACTOR_LABELS: Record<NotificationPayload["actor"], string> = {
  freelancer: "Freelancer",
  lp: "Liquidity Provider",
  payer: "Payer",
};

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function renderEmailTemplate(payload: NotificationPayload): RenderedEmailTemplate {
  const subject = normalizeText(payload.subject);
  const message = normalizeText(payload.message);
  const dueDate = formatUnixDate(payload.invoice.due_date);
  const details = buildDetails(payload, dueDate);
  const htmlDetailRows = details
    .map(
      ([label, value]) => `                    <tr>
                      <th scope="row" align="left" style="padding: 10px 12px; border-bottom: 1px solid #d8e1dd; color: #3f4d47; font-size: 13px; font-weight: 700;">${escapeHtml(label)}</th>
                      <td align="left" style="padding: 10px 12px; border-bottom: 1px solid #d8e1dd; color: #16231d; font-size: 14px; word-break: break-word;">${escapeHtml(value)}</td>
                    </tr>`
    )
    .join("\n");

  const text = renderEmailText(payload);
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "  <head>",
    '    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">',
    '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `    <title>${escapeHtml(subject)}</title>`,
    "    <style>",
    "      @media only screen and (max-width: 600px) {",
    "        .container { width: 100% !important; }",
    "        .content { padding: 24px 16px !important; }",
    "        .detail-table th, .detail-table td { display: block !important; width: 100% !important; box-sizing: border-box !important; }",
    "      }",
    "    </style>",
    "  </head>",
    '  <body style="margin: 0; padding: 0; background-color: #eef3f1; color: #16231d; font-family: Arial, Helvetica, sans-serif;">',
    `    <span class="preheader" style="display: none !important; visibility: hidden; opacity: 0; color: transparent; height: 0; width: 0; overflow: hidden;">${escapeHtml(message)}</span>`,
    '    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #eef3f1; border-collapse: collapse; margin: 0; padding: 0; width: 100%;">',
    "      <tr>",
    '        <td align="center" style="padding: 32px 12px;">',
    '          <table role="presentation" class="container" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color: #ffffff; border: 1px solid #d8e1dd; border-collapse: collapse; width: 600px; max-width: 600px;">',
    "            <tr>",
    '              <td class="content" style="padding: 32px;">',
    `                <div role="article" aria-roledescription="email" aria-label="${escapeHtml(subject)}">`,
    '                  <p style="margin: 0 0 12px; color: #506057; font-size: 13px; font-weight: 700; letter-spacing: 0; text-transform: uppercase;">Invoice Liquidity Network</p>',
    `                  <h1 style="margin: 0 0 16px; color: #14251d; font-size: 24px; line-height: 1.3; font-weight: 700;">${escapeHtml(subject)}</h1>`,
    `                  <p style="margin: 0 0 24px; color: #26352f; font-size: 16px; line-height: 1.5;">Hello ${escapeHtml(ACTOR_LABELS[payload.actor])}, ${escapeHtml(message)}</p>`,
    '                  <table role="table" class="detail-table" width="100%" cellspacing="0" cellpadding="0" border="0" aria-label="Invoice details" style="border: 1px solid #d8e1dd; border-collapse: collapse; width: 100%;">',
    htmlDetailRows,
    "                  </table>",
    '                  <p style="margin: 24px 0 0; color: #506057; font-size: 13px; line-height: 1.5;">You are receiving this notification because this Stellar address is subscribed to invoice updates.</p>',
    "                </div>",
    "              </td>",
    "            </tr>",
    "          </table>",
    "        </td>",
    "      </tr>",
    "    </table>",
    "  </body>",
    "</html>",
  ].join("\n");

  return { subject, html, text };
}

export function renderSmsTemplate(payload: NotificationPayload): string {
  const dueDate = formatUnixDate(payload.invoice.due_date);
  return normalizeText(
    [
      `ILN: ${payload.subject}`,
      `Invoice #${payload.invoice.id}`,
      `Status: ${payload.invoice.status}`,
      `Amount: ${payload.invoice.amount}`,
      `Due: ${dueDate}`,
    ].join(". ")
  );
}

function renderEmailText(payload: NotificationPayload): string {
  const dueDate = formatUnixDate(payload.invoice.due_date);
  return [
    "Invoice Liquidity Network",
    "",
    normalizeText(payload.subject),
    "",
    `Hello ${ACTOR_LABELS[payload.actor]},`,
    normalizeText(payload.message),
    "",
    `Invoice: #${payload.invoice.id}`,
    `Trigger: ${payload.trigger}`,
    `Status: ${payload.invoice.status}`,
    `Amount: ${payload.invoice.amount}`,
    `Due date: ${dueDate}`,
    `Freelancer: ${payload.invoice.freelancer}`,
    `Payer: ${payload.invoice.payer}`,
    ...(payload.invoice.funder ? [`Funder: ${payload.invoice.funder}`] : []),
    "",
    `Subscribed address: ${payload.recipientAddress}`,
  ].join("\n");
}

function buildDetails(
  payload: NotificationPayload,
  dueDate: string
): Array<[string, string]> {
  return [
    ["Invoice", `#${payload.invoice.id}`],
    ["Trigger", payload.trigger],
    ["Status", payload.invoice.status],
    ["Amount", payload.invoice.amount],
    ["Due date", dueDate],
    ["Freelancer", payload.invoice.freelancer],
    ["Payer", payload.invoice.payer],
    ...(payload.invoice.funder ? [["Funder", payload.invoice.funder] as [string, string]] : []),
    ["Subscribed address", payload.recipientAddress],
  ];
}

function formatUnixDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toISOString();
}

function normalizeText(value: unknown): string {
  return String(value).replace(/\s+/g, " ").trim();
}

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}
