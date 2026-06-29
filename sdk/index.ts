// sdk/index.ts

import { mapError } from './errors'
export { setLocale, detectLocale } from './errors'
export type { ErrorMessages } from './errors'

/**
 * Submit a new invoice on the ILN contract.
 *
 * @param invoke - A function that invokes a contract method by name.
 * @param params - The invoice submission parameters.
 * @param params.freelancer - Stellar address of the freelancer submitting the invoice.
 * @param params.payer - Stellar address of the payer responsible for the invoice.
 * @param params.amount - Invoice amount in the smallest unit (e.g. stroops for XLM).
 * @param params.dueDate - Unix timestamp (seconds) when the invoice is due.
 * @param params.discountRate - Discount rate in basis points (e.g. 500 = 5%).
 * @returns The newly created invoice ID.
 * @throws {Error} If the amount is invalid or the contract call fails.
 *
 * @example
 * ```ts
 * const invoiceId = await submitInvoice(invoke, {
 *   freelancer: "GABC...",
 *   payer: "GDEF...",
 *   amount: 1000000n,
 *   dueDate: Math.floor(Date.now() / 1000) + 86400,
 *   discountRate: 500,
 * });
 * ```
 */
export async function submitInvoice(invoke: any, params: {
  freelancer: string
  payer: string
  amount: number
  dueDate: number
  discountRate: number
}) {
  if (!params.amount || params.amount <= 0) {
    throw new Error('Invalid amount')
  }

  try {
    const res = await invoke('submit_invoice', params)
    return res.result
  } catch (err: any) {
    throw mapError(err)
  }
}

/**
 * Fund an existing invoice, providing liquidity to the freelancer.
 *
 * @param invoke - A function that invokes a contract method by name.
 * @param params - The funding parameters.
 * @param params.funder - Stellar address of the liquidity provider funding the invoice.
 * @param params.invoiceId - The ID of the invoice to fund.
 * @returns Resolves when the funding transaction completes successfully.
 * @throws {Error} If the invoice ID is invalid or the contract call fails.
 *
 * @example
 * ```ts
 * await fundInvoice(invoke, {
 *   funder: "GABC...",
 *   invoiceId: 42,
 * });
 * ```
 */
export async function fundInvoice(invoke: any, params: {
  funder: string
  invoiceId: number
}) {
  if (!params.invoiceId) {
    throw new Error('Invalid invoiceId')
  }

  try {
    await invoke('fund_invoice', params)
  } catch (err: any) {
    throw mapError(err)
  }
}

/**
 * Mark an invoice as paid, completing the payment cycle.
 *
 * @param invoke - A function that invokes a contract method by name.
 * @param params - The payment parameters.
 * @param params.invoiceId - The ID of the invoice to mark as paid.
 * @returns Resolves when the payment transaction completes successfully.
 * @throws {Error} If the invoice ID is invalid or the contract call fails.
 *
 * @example
 * ```ts
 * await markPaid(invoke, { invoiceId: 42 });
 * ```
 */
export async function markPaid(invoke: any, params: {
  invoiceId: number
}) {
  if (!params.invoiceId) {
    throw new Error('Invalid invoiceId')
  }

  try {
    await invoke('mark_paid', params)
  } catch (err: any) {
    throw mapError(err)
  }
}

/**
 * Claim a default on an unpaid invoice after the grace period has elapsed.
 *
 * @param invoke - A function that invokes a contract method by name.
 * @param params - The default claim parameters.
 * @param params.invoiceId - The ID of the invoice to claim default on.
 * @returns Resolves when the default claim transaction completes.
 * @throws {Error} If the invoice ID is invalid or the contract call fails.
 *
 * @example
 * ```ts
 * await claimDefault(invoke, { invoiceId: 42 });
 * ```
 */
export async function claimDefault(invoke: any, params: {
  invoiceId: number
}) {
  if (!params.invoiceId) {
    throw new Error('Invalid invoiceId')
  }

  try {
    await invoke('claim_default', params)
  } catch (err: any) {
    throw mapError(err)
  }
}

/**
 * Retrieve the current state of an invoice from the contract.
 *
 * @param invoke - A function that invokes a contract method by name.
 * @param params - The query parameters.
 * @param params.invoiceId - The ID of the invoice to retrieve.
 * @returns The invoice data including status, amounts, and participant addresses.
 * @throws {Error} If the invoice ID is invalid or the contract call fails.
 *
 * @example
 * ```ts
 * const invoice = await getInvoice(invoke, { invoiceId: 42 });
 * console.log(invoice.status); // "Pending" | "Funded" | "Paid" | "Defaulted"
 * ```
 */
export async function getInvoice(invoke: any, params: {
  invoiceId: number
}) {
  if (!params.invoiceId) {
    throw new Error('Invalid invoiceId')
  }

  try {
    const res = await invoke('get_invoice', params)
    return res
  } catch (err: any) {
    throw mapError(err)
  }
}

export { checkCompatibility, SDK_VERSION, MIN_CONTRACT_VERSION } from './src/compatibility'