# Multi-Token Support

Invoice Liquidity Network supports invoices denominated in allowlisted Stellar assets. The production token set is **USDC**, **EURC**, and **XLM**. Each token has distinct decimal precision, acquisition path, trustline behavior, and Soroban token contract shape.

---

## Token Overview

| Token | Asset type | Decimals | Smallest unit | Testnet acquisition | Trustline required | Soroban token contract ID (testnet) |
| --- | --- | ---: | --- | --- | --- | --- |
| USDC | Issued Stellar asset exposed through a Soroban token contract | 6 | `0.000001 USDC` | Fund with testnet XLM, add USDC trustline, then mint or receive test USDC | Yes | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| EURC | Issued Stellar asset exposed through a Soroban token contract | 6 | `0.000001 EURC` | Fund with testnet XLM, add EURC trustline, then mint or receive test EURC | Yes | `CA5DGX...` (see deployment README) |
| XLM | Native Stellar asset exposed through the native Stellar Asset Contract wrapper | 7 | `0.0000001 XLM` | Use Friendbot to fund the account directly on testnet | No | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` |

Known testnet issuers used by the development seeder:

| Token | Testnet issuer |
| --- | --- |
| USDC | `GBUQWP3BOUZX34TBIGK5ILGKDFHTQCXY4IQ7ZLVTLZHVNCV3XVJVTSC` |
| EURC | `GCNY5OXYSY4FZLQS2B4J5NE6BNUL37AJQ4NZ4PROUGH6TWYJF6XZMFC` |

---

## Token Selection Guide

Choosing which token to denominate an invoice in depends on the needs of the freelancer, payer, and liquidity provider.

| Factor | USDC | EURC | XLM |
| --- | --- | --- | --- |
| **Volatility** | Low (stablecoin pegged to USD) | Low (stablecoin pegged to EUR) | Moderate (market-driven) |
| **Typical use case** | General-purpose invoicing, USD-denominated contracts | Euro-zone freelancers and payers | Low-fee experimentation, micro-transactions, native Stellar apps |
| **Trustline required** | Yes | Yes | No |
| **XLM reserve impact** | None (asset balance is separate) | None (asset balance is separate) | Shared with fee/reserve balance — must keep minimum reserve |
| **Liquidity** | Highest — most widely traded | Moderate — euro-corridor pairs | High — native Stellar asset |
| **SDK decimals** | 6 | 6 | 7 |

### When to use each token

**USDC** is the default choice for most invoices. It is the most liquid stablecoin on Stellar, widely accepted, and carries minimal volatility risk for all parties.

**EURC** is the right choice when the invoicing relationship is euro-denominated. Freelancers and payers in the euro zone avoid USD/EUR conversion costs. The SDK treats EURC identically to USDC (6 decimals, trustline required), so switching between them is a one-line change.

**XLM** is best suited for experimentation, micro-transactions, and native Stellar applications where avoiding trustline friction matters. Because XLM is also used for transaction fees and account reserves, funding an invoice reduces the account's spendable XLM balance — integrations must ensure enough XLM remains for future transactions.

### Decision matrix

```text
Invoice involves USD or unspecified fiat?
  ├─ Yes → USDC
  └─ No
      └─ Invoice involves EUR?
          ├─ Yes → EURC
          └─ No
              └─ Need trustline-free or native Stellar settlement?
                  ├─ Yes → XLM
                  └─ No → USDC
```

---

## Code Examples Per Token

### Shared setup

All examples assume the SDK is installed and an `ILNSdk` instance is configured:

```ts
import { ILNSdk, ILN_TESTNET, createKeypairSigner } from "@iln/sdk";

const sdk = new ILNSdk({
  ...ILN_TESTNET,
  signer: createKeypairSigner(process.env.STELLAR_SECRET_KEY!),
});
```

### Token parsing utility

Use a token-aware parser to convert user-facing amounts to on-chain base units:

```ts
const TOKEN_DECIMALS = {
  USDC: 6,
  EURC: 6,
  XLM: 7,
} as const;

type SupportedToken = keyof typeof TOKEN_DECIMALS;

function parseTokenAmount(displayAmount: string, token: SupportedToken): bigint {
  const decimals = TOKEN_DECIMALS[token];
  const trimmed = displayAmount.trim();
  const match = trimmed.match(/^(\d+)(?:\.(\d+))?$/);

  if (!match) {
    throw new Error("Amount must be a positive decimal value.");
  }

  const fractional = match[2] ?? "";

  if (fractional.length > decimals) {
    throw new Error(`${token} supports at most ${decimals} decimal places.`);
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt(fractional.padEnd(decimals, "0") || "0");
  const scale = 10n ** BigInt(decimals);

  return whole * scale + fraction;
}

function formatTokenAmount(baseUnits: bigint, token: SupportedToken): string {
  const decimals = TOKEN_DECIMALS[token];
  const scale = 10n ** BigInt(decimals);
  const negative = baseUnits < 0n;
  const absolute = negative ? -baseUnits : baseUnits;
  const whole = absolute / scale;
  const fraction = (absolute % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  const rendered = fraction ? `${whole}.${fraction}` : whole.toString();

  return negative ? `-${rendered}` : rendered;
}
```

### USDC example

```ts
const amount = parseTokenAmount("1250.00", "USDC");
// amount = 1_250_000_000n (6 decimals)

const invoiceId = await sdk.submitInvoice({
  freelancer: "GA...",
  payer: "GB...",
  amount,
  dueDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  discountRate: 300, // 3.00%
});

console.log(`USDC invoice #${invoiceId} submitted for ${formatTokenAmount(amount, "USDC")} USDC`);
```

**Key points:**

- USDC uses 6 decimals: `1 USDC = 1_000_000` base units
- Requires a USDC trustline on the funder account before funding
- Display with 2 decimal places for UI summaries, up to 6 for exact values

### EURC example

```ts
const amount = parseTokenAmount("890.50", "EURC");
// amount = 890_500_000n (6 decimals)

const invoiceId = await sdk.submitInvoice({
  freelancer: "GA...",
  payer: "GC...",
  amount,
  dueDate: Math.floor(Date.now() / 1000) + 14 * 24 * 60 * 60,
  discountRate: 500, // 5.00%
});

console.log(`EURC invoice #${invoiceId} submitted for ${formatTokenAmount(amount, "EURC")} EURC`);
```

**Key points:**

- EURC uses the same decimal scale as USDC (6 decimals)
- Requires a separate EURC trustline — USDC trustlines do not cover EURC
- EURC has a distinct issuer and Soroban token contract from USDC
- The SDK treats USDC and EURC identically; the only difference is the `token` parameter passed to the contract

### XLM example

```ts
const amount = parseTokenAmount("250.5000001", "XLM");
// amount = 2_505_000_001n (7 decimals, stroops)

const invoiceId = await sdk.submitInvoice({
  freelancer: "GA...",
  payer: "GB...",
  amount,
  dueDate: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  discountRate: 200, // 2.00%
});

console.log(`XLM invoice #${invoiceId} submitted for ${formatTokenAmount(amount, "XLM")} XLM`);
```

**Key points:**

- XLM uses 7 decimals (stroops): `1 XLM = 10_000_000` stroops
- No trustline is needed — any funded Stellar account can hold XLM
- The same XLM balance pays fees, reserves, and invoice amounts — ensure the account retains its minimum reserve (`1 XLM` on testnet, `0.5 XLM` on mainnet after protocol 20)
- The Soroban token contract ID for native XLM is `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4`

---

## Token-Specific Considerations

### USDC

- **Precision**: 6 decimal places. Enter `"1.00"` to get `1_000_000` base units.
- **Trustline**: Required before an account can hold USDC. Use `changeTrust` operation with asset code `USDC` and the testnet issuer address.
- **Issuer**: Testnet issuer is `GBUQWP3BOUZX34TBIGK5ILGKDFHTQCXY4IQ7ZLVTLZHVNCV3XVJVTSC`. Mainnet uses the Circle-issued USDC on Stellar.
- **Display convention**: Stablecoin-style — commonly show 2 decimals in UIs (`$1,250.00`), up to 6 for exact settlement views.
- **Liquidity**: Highest of all three tokens. Most LPs will prefer funding USDC invoices.

### EURC

- **Precision**: 6 decimal places (same as USDC).
- **Trustline**: Required. Uses asset code `EURC` with the testnet issuer address. A USDC trustline does not authorize EURC.
- **Issuer**: Testnet issuer is `GCNY5OXYSY4FZLQS2B4J5NE6BNUL37AJQ4NZ4PROUGH6TWYJF6XZMFC`.
- **Use case**: Euro-denominated invoicing. Freelancers and payers in the euro zone avoid FX conversion costs.
- **Switching from USDC**: The SDK API is identical. Only the token address passed to `submit_invoice` changes.

### XLM

- **Precision**: 7 decimal places (stroops). `0.0000001 XLM` is the smallest unit.
- **Trustline**: Not required. XLM is native to Stellar.
- **Reserve requirement**: Every Stellar account must maintain a minimum XLM balance (`1 XLM` testnet, `0.5 XLM` mainnet after protocol 20). Funding an invoice reduces spendable XLM — do not drain the account below the reserve.
- **Fee currency**: All Stellar transaction fees are paid in XLM. Accounts must keep XLM aside for submission fees regardless of the invoice token.
- **Contract ID**: The native SAC wrapper address is `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4` on all networks.
- **Volatility**: Unlike USDC and EURC, XLM's market price fluctuates. Parties should consider price exposure when denominating invoices in XLM.

---

## Troubleshooting

### Trustline failures

**Problem:** `op_underfunded` or `op_no_trust` error when funding or settling an invoice.

**Cause:** The account receiving USDC or EURC has not established a trustline for that asset.

**Solution:**

```ts
import { TransactionBuilder, Operation, Keypair } from "@stellar/stellar-sdk";

const server = new rpc.Server("https://soroban-testnet.stellar.org");
const account = await server.getAccount(publicKey);

const tx = new TransactionBuilder(account, {
  fee: "100",
  networkPassphrase: "Test SDF Network ; September 2015",
})
  .addOperation(
    Operation.changeTrust({
      asset: new Asset("USDC", "GBUQWP3BOUZX34TBIGK5ILGKDFHTQCXY4IQ7ZLVTLZHVNCV3XVJVTSC"),
      limit: "9223372036854775807",
    }),
  )
  .setTimeout(30)
  .build();

tx.sign(Keypair.fromSecret(secretKey));
await server.sendTransaction(tx);
```

### Insufficient XLM for fees

**Problem:** `op_insufficient_balance` when submitting any transaction.

**Cause:** The source account does not have enough XLM to pay the transaction fee and maintain the minimum reserve.

**Solution:** Fund the account with additional XLM via Friendbot (testnet) or an exchange transfer (mainnet). A Soroban transaction typically requires `1-5 XLM` for fees plus the base reserve.

### Decimal precision errors

**Problem:** Amount displays as `"0.000001"` instead of `"1"`, or the contract rejects an amount as below minimum.

**Cause:** Confusing USDC/EURC 6-decimal units with XLM 7-decimal stroops, or applying the wrong scale.

**Solution:** Always use token-aware parsing (see [Code Examples](#code-examples-per-token) above). Never hard-code decimal assumptions. Validate with the utility:

```ts
parseTokenAmount("1", "USDC"); // 1_000_000n — correct
parseTokenAmount("1", "XLM");  // 10_000_000n — correct
```

A common mistake is treating XLM as 6-decimal:

```ts
// WRONG — applies USDC scale to XLM
BigInt("1") * 10n ** 6n; // 1_000_000n (only 0.1 XLM)

// RIGHT — use token-aware parser
parseTokenAmount("1", "XLM"); // 10_000_000n (1 XLM)
```

### Token not allowlisted

**Problem:** Contract returns `TokenNotAllowed` error.

**Cause:** The token contract address passed to `submit_invoice` is not in the protocol's allowlist.

**Solution:** Query the allowlist via the contract to see which tokens are currently enabled:

```bash
stellar contract invoke \
  --id CD3TE3IAHM737P236XZL2OYU275ZKD6MN7YH7PYYAXYIGEH55OPEWYJC \
  --source-account S... \
  --network testnet \
  -- \
  get_tokens
```

If the token is missing, submit a governance proposal to add it (see [Governance Guide](../governance-guide.md#add-a-new-supported-token)).

### Wrong token contract ID

**Problem:** Transaction simulates successfully but fails on submission with contract or token errors.

**Cause:** The wrong Soroban token contract ID was used for the selected token.

**Solution:** Verify the contract ID against the deployment table at the top of this guide. USDC, EURC, and XLM each have a distinct Soroban token contract address.

### XLM reserve too low after funding

**Problem:** After funding an XLM-denominated invoice, subsequent transactions fail with `op_insufficient_balance`.

**Cause:** The account's XLM balance dropped below the minimum reserve after paying the invoice amount.

**Solution:** Accounts funding XLM invoices must hold enough XLM above the reserve to cover the invoice amount plus fees. Monitor the balance before submitting:

```ts
const account = await server.getAccount(funderAddress);
const availableXLM = BigInt(account.balances.find((b: any) => b.asset_type === "native")?.balance ?? "0");
const reserve = 1_000_0000n; // 1 XLM in stroops (testnet)
const spendable = availableXLM - reserve;

if (invoiceAmount > spendable) {
  throw new Error("Insufficient XLM above reserve to fund this invoice");
}
```
