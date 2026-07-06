# ILN SDK Error Codes

This page catalogs error codes emitted by `@iln/sdk` so you can handle failures programmatically and recover quickly.

> Tip: SDK errors include a `code` plus a `remediation` string and optional `context`. Each code also links here (e.g. `docsUrl`).

## Error Code Index

- [`INVALID_DISCOUNT_RATE`](#invalid_discount_rate)
- [`TOKEN_MISMATCH`](#token_mismatch)
- [`PAYER_REPUTATION_TOO_LOW`](#payer_reputation_too_low)
- [`INSUFFICIENT_BALANCE`](#insufficient_balance)
- [`NETWORK_ERROR`](#network_error)
- [`TRANSACTION_FAILED`](#transaction_failed)
- [`VALIDATION_ERROR`](#validation_error)
- [`WALLET_NOT_CONNECTED`](#wallet_not_connected)
- [`CONTRACT_ERROR`](#contract_error)
- [`SIMULATION_FAILED`](#simulation_failed)

---

## INVALID_DISCOUNT_RATE

**What it means**: The provided `discountRate` is outside the allowed protocol bounds.

**How to fix**:
1. Call `sdk.getProtocolConfig()` and check `maxDiscountRate` / allowed range.
2. Ensure you are passing **basis points (bps)** (e.g., `300 = 3%`).
3. Retry the operation.

**Example**:
```ts
try {
  await sdk.submitInvoice({ /* ... */, discountRate: 999999 })
} catch (err) {
  if ((err as any).code === 'INVALID_DISCOUNT_RATE') {
    // prompt user to adjust discountRate
  }
}
```

---

## TOKEN_MISMATCH

**What it means**: The token contract ID/address used to build the transaction does not match the token expected for the invoice/protocol.

**How to fix**:
1. Compare the token addresses/contract IDs from `getInvoice()` and/or `getProtocolConfig()`.
2. Rebuild the transaction using the expected token configuration.

---

## PAYER_REPUTATION_TOO_LOW

**What it means**: The payer does not meet the protocol minimum reputation threshold.

**How to fix**:
1. Check payer reputation and ensure the payer account is eligible.
2. Use a different payer or re-evaluate the invoice workflow.

---

## INSUFFICIENT_BALANCE

**What it means**: The account does not have enough funds (including fees) to complete the transaction.

**How to fix**:
1. Fund the account (testnet: Friendbot / mainnet: transfer XLM).
2. Retry.

---

## NETWORK_ERROR

**What it means**: The SDK failed to reach the configured Stellar RPC endpoint.

**How to fix**:
1. Verify `rpcUrl`.
2. Check connectivity and RPC server health.
3. Retry.

---

## TRANSACTION_FAILED

**What it means**: The contract rejected the transaction during on-chain execution.

**How to fix**:
1. Review the failure reason (enable debug logging if available).
2. Verify the invoice state matches the operation (e.g., funded/paid/defaulted).
3. Confirm fee/resource settings and try isolating the failing operation (especially in batches).

---

## VALIDATION_ERROR

**What it means**: Input validation failed before submitting to the network.

**How to fix**:
1. Validate your inputs using `Validators`.
2. Ensure field types/constraints match expectations.

---

## WALLET_NOT_CONNECTED

**What it means**: A signer is required for state-changing operations, but no signer is configured/available.

**How to fix**:
1. Provide `signer` in `ILNSdk` configuration.
2. In browser apps, ensure Freighter is installed/unlocked and the signer is accessible.

---

## CONTRACT_ERROR

**What it means**: The contract rejected the transaction, and the SDK could not classify the specific failure reason.

**How to fix**:
1. Inspect the raw on-chain error details (available via `context.rawError` when present).
2. Check the invoice/operation parameters and contract state.
3. Retry with corrected inputs.

---

## SIMULATION_FAILED

**What it means**: The SDK could not simulate the transaction successfully.

**How to fix**:
1. Verify transaction parameters.
2. Ensure contract state is consistent with the operation.
3. Retry.

