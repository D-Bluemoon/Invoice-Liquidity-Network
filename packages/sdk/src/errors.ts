/**
 * Custom error classes for the Invoice Liquidity Network SDK.
 *
 * Each class extends `Error` with a fixed `name` property so consumers
 * can use `instanceof` checks for type-safe error handling.
 *
 * @example
 * ```ts
 * import { ContractCallError } from '@iln/sdk/errors';
 *
 * try {
 *   await client.getReputation(address);
 * } catch (err) {
 *   if (err instanceof ContractCallError) {
 *     console.error(err.method, err.contractId);
 *   }
 * }
 * ```
 */

/**
 * Thrown when a Soroban contract simulation or invocation fails.
 */
export class ContractCallError extends Error {
  override name = 'ContractCallError';

  /**
   * @param message - Human-readable error description.
   * @param contractId - The contract address (C...) that was called.
   * @param method - The contract method that failed.
   */
  constructor(
    message: string,
    public readonly contractId?: string,
    public readonly method?: string,
  ) {
    super(message);
  }
}

/**
 * Thrown when an invalid Stellar address (G... / C...) is provided.
 */
export class InvalidAddressError extends Error {
  override name = 'InvalidAddressError';

  /**
   * @param message - Human-readable error description.
   * @param address - The invalid address value.
   */
  constructor(
    message: string,
    public readonly address?: string,
  ) {
    super(message);
  }
}

/**
 * Thrown when XDR parsing or decoding fails.
 */
export class XDRParseError extends Error {
  override name = 'XDRParseError';

  /**
   * @param message - Human-readable error description.
   */
  constructor(message: string) {
    super(message);
  }
}

/**
 * Thrown when a network request to Horizon or Soroban RPC fails.
 */
export class NetworkError extends Error {
  override name = 'NetworkError';

  /**
   * @param message - Human-readable error description.
   * @param statusCode - Optional HTTP status code.
   */
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
  }
}
