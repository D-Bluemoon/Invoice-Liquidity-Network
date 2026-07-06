/**
 * Base error class for all ILN SDK errors.
 *
 * Provides structured error codes and remediation guidance.
 */
export class ILNError extends Error {
  /** Machine-readable error code (e.g. "INSUFFICIENT_BALANCE"). */
  public code: string;
  /** Human-readable suggestion for resolving the error. */
  public remediation: string;
  /** Optional documentation URL for this error code. */
  public docsUrl?: string;
  /** Optional structured debugging context (never include secrets). */
  public context?: Record<string, unknown>;
  /** Whether the operation is likely retryable. */
  public retryable?: boolean;
  /** Preserve original error for debugging. */
  public cause?: unknown;

  constructor(
    message: string,
    code: string,
    remediation: string,
    options?: {
      docsUrl?: string;
      context?: Record<string, unknown>;
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.code = code;
    this.remediation = remediation;

    if (options?.docsUrl) this.docsUrl = options.docsUrl;
    if (options?.context) this.context = options.context;
    if (typeof options?.retryable === 'boolean') this.retryable = options.retryable;
    if (options && 'cause' in options) this.cause = options.cause;
  }
}

const DEFAULT_DOCS_BASE_URL =
  'https://github.com/Invoice-Liquidity-Network/Invoice-Liquidity-Network/blob/main/docs/errors.md';

function withDocs(code: string): string {
  // Link to an anchor on docs/errors.md for programmatic navigation.
  return `${DEFAULT_DOCS_BASE_URL}#${code}`;
}

/**
 * Thrown when the provided discount rate exceeds protocol limits.
 */
export class InvalidDiscountRateError extends ILNError {
  constructor(context?: Record<string, unknown>) {
    super(
      "Invalid discount rate.",
      "INVALID_DISCOUNT_RATE",
      "Check `discountRate` is within the protocol bounds (see `getProtocolConfig().maxDiscountRate`). If you are using basis points, ensure the value is in bps (e.g., 300 = 3%).",
      {
        docsUrl: withDocs("INVALID_DISCOUNT_RATE"),
        context,
        retryable: false,
      },
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a token mismatch occurs in a transaction.
 */
export class TokenMismatchError extends ILNError {
  constructor(context?: Record<string, unknown>) {
    super(
      'Token mismatch in transaction.',
      'TOKEN_MISMATCH',
      'Verify that the token contract ID/address used to build the transaction matches the token configured for the invoice/protocol. (If you call `getInvoice()` / `getProtocolConfig()`, compare the expected token information.)',
      {
        docsUrl: withDocs('TOKEN_MISMATCH'),
        context,
        retryable: false,
      },
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the payer's reputation score is below the protocol minimum.
 */
export class PayerReputationTooLowError extends ILNError {
  constructor(context?: Record<string, unknown>) {
    super(
      'Payer reputation is too low.',
      'PAYER_REPUTATION_TOO_LOW',
      'The payer does not meet the protocol minimum reputation threshold for this invoice. Check the payer reputation score and re-submit with an eligible payer.',
      {
        docsUrl: withDocs('PAYER_REPUTATION_TOO_LOW'),
        context,
        retryable: false,
      },
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the account has insufficient balance for a transaction.
 */
export class InsufficientBalanceError extends ILNError {
  constructor(
    message = 'Insufficient balance to complete the transaction.',
    remediation = 'Ensure the account has enough funds (including transaction fees) before retrying. If you are on testnet, you can fund the account and then re-submit.',
    context?: Record<string, unknown>,
  ) {
    super(message, 'INSUFFICIENT_BALANCE', remediation, {
      docsUrl: withDocs('INSUFFICIENT_BALANCE'),
      context,
      retryable: true,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a network request to the RPC server fails.
 */
export class NetworkError extends ILNError {
  constructor(
    message = 'Network request failed.',
    remediation = 'Failed to reach the configured Stellar RPC endpoint. Verify your `rpcUrl`, check connectivity, and ensure the RPC server is healthy.',
    context?: Record<string, unknown>,
  ) {
    super(message, 'NETWORK_ERROR', remediation, {
      docsUrl: withDocs('NETWORK_ERROR'),
      context,
      retryable: true,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a transaction fails to execute on-chain.
 */
export class TransactionFailedError extends ILNError {
  constructor(
    message = 'Transaction execution failed on-chain.',
    remediation = 'The contract rejected the transaction. Review the simulation/tx failure reason, verify the invoice state (e.g., funded/paid/defaulted), and confirm fee/resource settings. If you are using a batch, try isolating the failing operation.',
    context?: Record<string, unknown>,
  ) {
    super(message, 'TRANSACTION_FAILED', remediation, {
      docsUrl: withDocs('TRANSACTION_FAILED'),
      context,
      retryable: false,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when input validation fails.
 */
export class ValidationError extends ILNError {
  constructor(
    message = 'Validation failed.',
    remediation = 'Check the provided input parameters. Use `Validators` to validate fields and inspect which constraint failed.',
    context?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', remediation, {
      docsUrl: withDocs('VALIDATION_ERROR'),
      context,
      retryable: false,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a wallet is required but not connected.
 */
export class WalletNotConnectedError extends ILNError {
  constructor(
    message = 'Wallet is not connected.',
    remediation = 'A transaction signer is required for this state-changing operation. Provide a `signer` in the `ILNSdk` configuration (or ensure the Freighter signer is available in browser).',
    context?: Record<string, unknown>,
  ) {
    super(message, 'WALLET_NOT_CONNECTED', remediation, {
      docsUrl: withDocs('WALLET_NOT_CONNECTED'),
      context,
      retryable: false,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for generic contract errors that don't match specific error types.
 */
export class GenericContractError extends ILNError {
  constructor(rawError: string, context?: Record<string, unknown>) {
    super(
      `Contract error: ${rawError}`,
      'CONTRACT_ERROR',
      'The contract rejected the transaction, but the SDK could not classify the exact failure reason. Check the invoice/operation parameters and inspect the on-chain error details. If possible, retry with corrected inputs or consult the contract logic/state.',
      {
        docsUrl: withDocs('CONTRACT_ERROR'),
        context: {
          rawError,
          ...(context ?? {}),
        },
        retryable: false,
      },
    );
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SimulationError extends ILNError {
  constructor(
    message = 'Transaction simulation failed.',
    remediation = 'The SDK could not simulate the transaction successfully. Review the transaction parameters and ensure contract state is consistent (e.g., the invoice exists and is in the expected state). Then retry.',
    context?: Record<string, unknown>,
  ) {
    super(message, 'SIMULATION_FAILED', remediation, {
      docsUrl: withDocs('SIMULATION_FAILED'),
      context,
      retryable: false,
    });
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Parse a raw contract error into a typed ILNError.
 * Maps known error strings to specific error classes when possible.
 *
 * @param xdrError - The raw error value from the contract.
 * @returns A typed ILNError instance.
 *
 * @example
 * ```ts
 * try {
 *   await sdk.submitInvoice(params);
 * } catch (err) {
 *   const ilnError = parseContractError(err);
 *   console.log(ilnError.code);    // e.g. "INVALID_DISCOUNT_RATE"
 *   console.log(ilnError.remediation);
 * }
 * ```
 */
export function parseContractError(xdrError: unknown): ILNError {
  const errorStr = typeof xdrError === 'string' ? xdrError : JSON.stringify(xdrError);

  const baseContext = {
    rawError: errorStr,
  } as Record<string, unknown>;

  if (errorStr.includes('InvalidDiscountRate')) {
    return new InvalidDiscountRateError({ ...baseContext, matchedPattern: 'InvalidDiscountRate' });
  }
  if (errorStr.includes('TokenMismatch')) {
    return new TokenMismatchError({ ...baseContext, matchedPattern: 'TokenMismatch' });
  }
  if (errorStr.includes('PayerReputationTooLow')) {
    return new PayerReputationTooLowError({ ...baseContext, matchedPattern: 'PayerReputationTooLow' });
  }

  return new GenericContractError(errorStr, {
    matchedPattern: 'Unknown',
  });
}
