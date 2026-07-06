import { Horizon } from '@stellar/stellar-sdk';

/**
 * Supported transaction types for filtering history.
 * Maps to Horizon operation type strings.
 */
export type TransactionType =
  | 'payment'
  | 'create_account'
  | 'change_trust'
  | 'manage_sell_offer'
  | 'manage_buy_offer'
  | 'path_payment_strict_send'
  | 'path_payment_strict_receive'
  | 'invoke_host_function';

/**
 * A normalised transaction record returned by {@link InvoiceClient.getTransactionHistory}.
 */
export interface TransactionRecord {
  /** Unique operation ID from Horizon. */
  id: string;
  /** ISO-8601 timestamp of when the operation was included in a ledger. */
  createdAt: string;
  /** Horizon operation type string (e.g. `"payment"`, `"invoke_host_function"`). */
  type: TransactionType | string;
  /** Source account that submitted the transaction. */
  from: string;
  /** Destination account (present for payment-like operations). */
  to?: string;
  /** Asset code (e.g. `"XLM"`, `"USDC"`). */
  asset?: string;
  /** Human-readable amount as a string to preserve decimal precision. */
  amount?: string;
  /** Hash of the parent transaction envelope. */
  transactionHash: string;
}

/**
 * Options for {@link InvoiceClient.getTransactionHistory}.
 */
export interface TransactionHistoryOptions {
  /**
   * Filter to a specific operation type.
   * When omitted all types are returned.
   */
  type?: TransactionType | string;
  /**
   * Inclusive lower bound (ISO-8601 or `Date`).
   * Operations with `created_at` before this value are excluded.
   */
  startDate?: string | Date;
  /**
   * Inclusive upper bound (ISO-8601 or `Date`).
   * Operations with `created_at` after this value are excluded.
   */
  endDate?: string | Date;
  /**
   * Number of records per page (1–200, default 20).
   * Horizon caps this at 200.
   */
  limit?: number;
  /**
   * Pagination cursor returned by a previous call as `nextCursor`.
   * Pass this value to fetch the next page of results.
   */
  cursor?: string;
  /**
   * Sort order for results (default `"desc"` — newest first).
   */
  order?: 'asc' | 'desc';
}

/**
 * Paginated response from {@link InvoiceClient.getTransactionHistory}.
 */
export interface TransactionHistoryPage {
  /** The records on this page. */
  records: TransactionRecord[];
  /**
   * Cursor to pass as `cursor` to fetch the next page.
   * `undefined` when there are no more pages.
   */
  nextCursor?: string;
  /** Total number of records returned on this page. */
  count: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function normaliseOperation(op: any): TransactionRecord {
  return {
    id: op.id,
    createdAt: op.created_at,
    type: op.type,
    from: op.source_account ?? op.from ?? '',
    to: op.to,
    asset:
      op.asset_type === 'native'
        ? 'XLM'
        : op.asset_code ?? op.selling_asset_code ?? op.buying_asset_code,
    amount: op.amount ?? op.starting_balance,
    transactionHash: op.transaction_hash,
  };
}

/**
 * Converts an array of {@link TransactionRecord} objects to a CSV string.
 *
 * @param records - The records to serialise.
 * @returns A UTF-8 CSV string with a header row.
 */
export function exportTransactionsToCsv(records: TransactionRecord[]): string {
  const headers = [
    'id',
    'createdAt',
    'type',
    'from',
    'to',
    'asset',
    'amount',
    'transactionHash',
  ] as const;

  const escape = (value: string | undefined): string => {
    if (value === undefined || value === '') return '';
    // Wrap in quotes and escape any inner quotes per RFC 4180
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) =>
    headers.map((h) => escape(r[h])).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Client for interacting with the Invoice Liquidity Network protocol on Stellar.
 *
 * Provides methods to create, fund, and settle invoices via the ILN smart contract,
 * and to query, filter, paginate, and export an account's transaction history.
 *
 * @example
 * ```ts
 * const client = new InvoiceClient(
 *   'https://horizon-testnet.stellar.org',
 *   'CA3D...',
 * );
 *
 * // Fetch the last 10 payments
 * const page = await client.getTransactionHistory('GB...', {
 *   type: 'payment',
 *   limit: 10,
 * });
 *
 * // Export to CSV
 * const csv = exportTransactionsToCsv(page.records);
 * ```
 */
export class InvoiceClient {
  private server: Horizon.Server;
  private contractId: string;

  /**
   * Creates a new InvoiceClient instance.
   *
   * @param serverUrl - The Horizon server URL (e.g., `https://horizon-testnet.stellar.org`).
   * @param contractId - The deployed InvoiceLiquidity contract address on Stellar.
   */
  constructor(serverUrl: string, contractId: string) {
    this.server = new Horizon.Server(serverUrl);
    this.contractId = contractId;
  }

  // -------------------------------------------------------------------------
  // Invoice lifecycle
  // -------------------------------------------------------------------------

  /**
   * Submits a new invoice to the ILN smart contract for liquidity.
   *
   * @param invoiceData - The invoice payload to submit on-chain.
   * @returns A promise that resolves when the invoice has been submitted.
   */
  public async submitInvoice(invoiceData: any): Promise<void> {
    console.log('Submitting invoice...');
  }

  /**
   * Funds a pending invoice as a liquidity provider.
   *
   * @param invoiceId - The unique identifier of the invoice to fund.
   * @returns A promise that resolves when the funding transaction is complete.
   */
  public async fundInvoice(invoiceId: string): Promise<void> {
    console.log('Funding invoice: ' + invoiceId);
  }

  /**
   * Marks an invoice as paid, releasing the escrowed funds to the liquidity provider.
   *
   * @param invoiceId - The unique identifier of the invoice to mark as paid.
   * @returns A promise that resolves when the payment has been confirmed on-chain.
   */
  public async markPaid(invoiceId: string): Promise<void> {
    console.log('Marking invoice as paid: ' + invoiceId);
  }

  // -------------------------------------------------------------------------
  // Transaction history
  // -------------------------------------------------------------------------

  /**
   * Fetches paginated transaction history for a Stellar account.
   *
   * Results are sourced from the Horizon payments endpoint and normalised into
   * {@link TransactionRecord} objects. Client-side filters are applied after
   * the Horizon response so that `limit` reflects the number of records
   * **returned to the caller** (post-filter), not the raw Horizon page size.
   *
   * @param accountId - The Stellar public key (`G...`) to query.
   * @param options - Optional filters, pagination cursor, and sort order.
   * @returns A {@link TransactionHistoryPage} containing records and a cursor
   *   for the next page.
   *
   * @example
   * ```ts
   * // Page 1
   * const page1 = await client.getTransactionHistory('GB...', { limit: 20 });
   *
   * // Page 2
   * const page2 = await client.getTransactionHistory('GB...', {
   *   limit: 20,
   *   cursor: page1.nextCursor,
   * });
   * ```
   */
  public async getTransactionHistory(
    accountId: string,
    options: TransactionHistoryOptions = {},
  ): Promise<TransactionHistoryPage> {
    const {
      type,
      startDate,
      endDate,
      limit = 20,
      cursor,
      order = 'desc',
    } = options;

    const clampedLimit = Math.min(Math.max(1, limit), 200);

    // Fetch from Horizon — request more than needed so client-side filtering
    // doesn't leave the caller with fewer records than expected on sparse pages.
    const horizonLimit = Math.min(clampedLimit * 3, 200);

    let query = this.server
      .payments()
      .forAccount(accountId)
      .limit(horizonLimit)
      .order(order);

    if (cursor) {
      query = query.cursor(cursor);
    }

    const response = await query.call();
    const raw: any[] = response.records ?? [];

    // Normalise
    let records = raw.map(normaliseOperation);

    // Filter by type
    if (type) {
      records = records.filter((r) => r.type === type);
    }

    // Filter by date range
    if (startDate) {
      const start = toDate(startDate).getTime();
      records = records.filter(
        (r) => new Date(r.createdAt).getTime() >= start,
      );
    }

    if (endDate) {
      const end = toDate(endDate).getTime();
      records = records.filter(
        (r) => new Date(r.createdAt).getTime() <= end,
      );
    }

    // Trim to requested limit
    const page = records.slice(0, clampedLimit);

    // Build next-page cursor from the last raw Horizon record (pre-filter)
    // so that subsequent calls continue from where Horizon left off.
    const lastRaw = raw[raw.length - 1];
    const nextCursor =
      raw.length > 0 && page.length === clampedLimit
        ? lastRaw.paging_token
        : undefined;

    return {
      records: page,
      nextCursor,
      count: page.length,
    };
  }
}
