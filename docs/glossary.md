# Glossary

Protocol terminology used across ILN docs, SDKs, contracts, indexer, and notifications. Terms are sorted alphabetically.

## Basis Points (bps)

A unit equal to one-hundredth of one percent, so 100 bps equals 1%. ILN uses bps for discount rates, fees, and yield calculations because integer math is safer in contracts and SDKs.

See: [Protocol Economics](protocol-economics.md)

## Circuit Breaker

A safety control that pauses or limits sensitive protocol actions during an incident. In ILN, circuit breakers are relevant to contract funding, settlement, upgrades, indexing, and notification delivery.

See: [Security](security.md)

## Discount Rate

The percentage discount a submitter accepts in exchange for receiving liquidity before the payer settles the invoice. A 300 bps discount means the liquidity provider funds 97% of face value and earns the 3% spread at settlement.

See: [Protocol Economics](protocol-economics.md)

## Effective Yield

The annualized return implied by the discount rate and time to settlement. ILN examples commonly calculate this as `(discount_bps / 10000) * (365 / days_to_settlement)`.

See: [LP Funding Tutorial](tutorials/lp-funding.md)

## HMAC

Hash-based Message Authentication Code, a signature-like digest used to verify that a webhook payload came from the expected sender and was not modified. ILN notification receivers should reject webhook requests with missing or invalid HMAC values.

See: [Notifications](notifications.md)

## Horizon

Stellar's REST API service for account data, transactions, ledgers, assets, and network metadata. ILN tooling may use Horizon alongside Soroban RPC for account and network state.

See: [Stellar Primer](stellar-primer.md)

## Invoice Factoring

A financing model where an invoice holder sells or discounts an unpaid invoice to receive cash before the payer settles. ILN implements a DeFi version where liquidity providers fund invoices on-chain and receive settlement value later.

See: [Protocol Overview](protocol-overview.md)

## Ledger

An ordered batch of Stellar transactions accepted by network consensus. ILN indexers track ledger ranges to reconstruct invoice events and settlement state.

See: [Indexer Data Model](indexer-data-model.md)

## Liquidity Provider (LP)

A participant who funds invoices by providing liquidity at the discounted amount. The LP expects to receive the invoice face value at settlement and earns the difference as yield.

See: [LP Funding Tutorial](tutorials/lp-funding.md)

## Payer

The customer or counterparty responsible for settling the invoice. ILN uses payer identity and behavior as part of invoice authorization, settlement, and reputation flows.

See: [Submit Your First Invoice](tutorials/first-invoice.md)

## Quorum

The minimum approval threshold required for a governance or administrative decision. ILN uses quorum concepts for maintainer sign-off, governance changes, and mainnet readiness decisions.

See: [Governance Guide](governance-guide.md)

## Reputation Score

A score that represents observed reliability for submitters, payers, or related protocol actors. ILN reputation can help liquidity providers assess invoice risk and discount expectations.

See: [Reputation Contract](contracts/reputation-contract.md)

## Settlement

The point where the payer's obligation is marked as paid and the protocol releases or accounts for final value owed to the liquidity provider. Settlement changes invoice state and is a core event for indexer and notification consumers.

See: [Invoice Contract](contracts/invoice-contract.md)

## Soroban

Stellar's smart contract platform, where contracts are compiled to WebAssembly and run with Stellar ledger integration. ILN contract logic for invoices, reputation, and governance is designed for Soroban.

See: [Stellar Primer](stellar-primer.md)

## Stellar Asset Contract (SAC)

A Soroban contract interface that represents Stellar assets for smart contract use. ILN uses SAC-compatible assets such as USDC-style stablecoins for funding and settlement flows.

See: [Multi-Token Support](tokens/multi-token-support.md)

## Submitter

The account or service that submits an invoice transaction to the network. The submitter may be the invoice owner directly or an authorized integration using the SDK or CLI.

See: [SDK Quickstart](sdk-quickstart.md)

## Timelock

A delay between approval and execution of a sensitive action, such as an upgrade or parameter change. Timelocks give users and maintainers time to inspect pending governance changes before they take effect.

See: [Governance Guide](governance-guide.md)

## Trustline

A Stellar account's explicit opt-in to hold a non-native asset. Users must have the correct trustline before receiving or transacting certain Stellar assets outside pure Soroban contract custody.

See: [Stellar Primer](stellar-primer.md)

## XDR

External Data Representation, the binary serialization format used by Stellar for transactions, operations, ledger entries, and contract data. ILN SDK and CLI code must encode and decode XDR exactly to avoid signing or submission bugs.

See: [`sdk/src/xdr.ts`](../sdk/src/xdr.ts)

## Yield

The return earned by a liquidity provider for funding an invoice. In ILN, yield usually comes from the discount between the funded amount and the invoice face value paid at settlement.

See: [Protocol Economics](protocol-economics.md)
