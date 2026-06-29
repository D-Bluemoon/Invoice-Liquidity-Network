/**
 * Email templates barrel (#446)
 *
 * Re-exports all template renderers and subject-line builders so callers can
 * import from a single entry point:
 *
 *   import { renderFundedEmail, buildFundedSubject } from "./templates";
 */

export { renderFundedEmail, buildFundedSubject } from "./funded.template";
export type { FundedTemplateVars } from "./funded.template";

export { renderPaymentEmail, buildPaymentSubject } from "./payment.template";
export type { PaymentTemplateVars } from "./payment.template";

export { renderDisputeEmail, buildDisputeSubject } from "./dispute.template";
export type { DisputeTemplateVars } from "./dispute.template";

export { renderDueWarningEmail, buildDueWarningSubject } from "./due-warning.template";
export type { DueWarningTemplateVars } from "./due-warning.template";

export { emailShell, formatAmount, formatDate, shortAddress, escapeHtml } from "./helpers";
