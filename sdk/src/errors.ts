/**
 * Base error class for all ILN SDK errors.
 * Provides structured error codes and remediation guidance.
 *
 * @property code - Machine-readable error code (e.g. "INSUFFICIENT_BALANCE").
 * @property remediation - Human-readable suggestion for resolving the error.
 */
export class ILNError extends Error {
  public code: string;
  public remediation: string;

  constructor(message: string, code: string, remediation: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = this.constructor.name;
    this.code = code;
    this.remediation = remediation;
  }
}

/**
 * Thrown when the provided discount rate exceeds protocol limits.
 */
export class InvalidDiscountRateError extends ILNError {
  constructor() { 
    super("Invalid discount rate provided.", "INVALID_DISCOUNT_RATE", "Ensure the discount rate is within the allowed bounds."); 
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a token mismatch occurs in a transaction.
 */
export class TokenMismatchError extends ILNError {
  constructor() { 
    super("Token mismatch in transaction.", "TOKEN_MISMATCH", "Verify that the correct token addresses are being used."); 
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the payer's reputation score is below the protocol minimum.
 */
export class PayerReputationTooLowError extends ILNError {
  constructor() { 
    super("Payer reputation is too low.", "PAYER_REPUTATION_TOO_LOW", "The payer must improve their reputation score before proceeding."); 
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when the account has insufficient balance for a transaction.
 */
export class InsufficientBalanceError extends ILNError {
  constructor(message = "Insufficient balance to complete the transaction.", remediation = "Ensure the account has enough funds before retrying.") {
    super(message, "INSUFFICIENT_BALANCE", remediation);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a network request to the RPC server fails.
 */
export class NetworkError extends ILNError {
  constructor(message = "Network request failed.", remediation = "Check your internet connection or the RPC server status.") {
    super(message, "NETWORK_ERROR", remediation);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a transaction fails to execute on-chain.
 */
export class TransactionFailedError extends ILNError {
  constructor(message = "Transaction execution failed on-chain.", remediation = "Review transaction logs, fee configuration, or contract state.") {
    super(message, "TRANSACTION_FAILED", remediation);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when input validation fails.
 */
export class ValidationError extends ILNError {
  constructor(message = "Validation failed.", remediation = "Check input parameters.") {
    super(message, "VALIDATION_ERROR", remediation);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a wallet is required but not connected.
 */
export class WalletNotConnectedError extends ILNError {
  constructor(message = "Wallet is not connected.", remediation = "Connect your wallet before calling state-changing operations.") {
    super(message, "WALLET_NOT_CONNECTED", remediation);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown for generic contract errors that don't match specific error types.
 */
export class GenericContractError extends ILNError {
  constructor(rawError: string) { 
    super(`Contract error: ${rawError}`, "CONTRACT_ERROR", "Check contract logic or inputs."); 
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class SimulationError extends ILNError {
  constructor(message = "Transaction simulation failed.", remediation = "Review transaction parameters and contract state.") {
    super(message, "SIMULATION_FAILED", remediation);
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
  if (errorStr.includes("InvalidDiscountRate")) return new InvalidDiscountRateError();
  if (errorStr.includes("TokenMismatch")) return new TokenMismatchError();
  if (errorStr.includes("PayerReputationTooLow")) return new PayerReputationTooLowError();
  return new GenericContractError(errorStr);
}
