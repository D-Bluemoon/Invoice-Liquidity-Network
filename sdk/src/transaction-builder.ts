/**
 * Fluent Transaction Builder (#504)
 *
 * Provides a chainable builder API for constructing Stellar transactions
 * without repeatedly calling low-level SDK methods. Supports memo, timebounds,
 * fee configuration, and a one-shot sign step.
 *
 * Usage:
 *   const tx = await new FluentTransactionBuilder(rpcClient)
 *     .source("G...")
 *     .fee(200)
 *     .timeout(30)
 *     .memo("Invoice #42 payment")
 *     .timebounds(minTime, maxTime)
 *     .addOperation(op1)
 *     .addOperation(op2)
 *     .build();
 *
 *   tx.sign(keypair);
 *   await server.submitTransaction(tx.transaction);
 */

import {
  TransactionBuilder,
  Networks,
  Memo,
  MemoType,
  Operation,
  Transaction,
  Keypair,
} from "@stellar/stellar-sdk";
import type { RpcClient, SimulationResult } from "./transaction";

// ── Types ──────────────────────────────────────────────────────────────────

export interface BuildResult {
  transaction: Transaction;
  simulation: SimulationResult | null;
}

export type MemoValue =
  | { type: "text"; value: string }
  | { type: "id"; value: string }
  | { type: "hash"; value: Buffer }
  | { type: "return"; value: Buffer }
  | { type: "none" };

// ── FluentTransactionBuilder ───────────────────────────────────────────────

export class FluentTransactionBuilder {
  private _source = "";
  private _fee = 100;
  private _maxFee = 1000;
  private _timeout = 30;
  private _networkPassphrase = Networks.TESTNET;
  private _operations: Operation[] = [];
  private _memo: MemoValue = { type: "none" };
  private _minTime: number | null = null;
  private _maxTime: number | null = null;
  private _simulate = true;

  constructor(private readonly rpc: RpcClient) {}

  // ── Fluent setters ───────────────────────────────────────────────────────

  /** Stellar source account address. */
  source(address: string): this {
    this._source = address;
    return this;
  }

  /** Base fee in stroops (default 100). */
  fee(stroops: number): this {
    this._fee = stroops;
    return this;
  }

  /** Maximum fee cap in stroops (default 1000). */
  maxFee(stroops: number): this {
    this._maxFee = stroops;
    return this;
  }

  /** Transaction timeout in seconds (default 30). */
  timeout(seconds: number): this {
    this._timeout = seconds;
    return this;
  }

  /** Network passphrase. Defaults to TESTNET. */
  network(passphrase: string): this {
    this._networkPassphrase = passphrase;
    return this;
  }

  /** Convenience shortcut: switch to mainnet passphrase. */
  mainnet(): this {
    return this.network(Networks.PUBLIC);
  }

  /** Add a text memo (max 28 bytes). */
  memo(text: string): this {
    this._memo = { type: "text", value: text };
    return this;
  }

  /** Add an ID memo. */
  memoId(id: string): this {
    this._memo = { type: "id", value: id };
    return this;
  }

  /** Add a hash memo (32-byte Buffer). */
  memoHash(hash: Buffer): this {
    this._memo = { type: "hash", value: hash };
    return this;
  }

  /** Add a return hash memo (32-byte Buffer). */
  memoReturn(hash: Buffer): this {
    this._memo = { type: "return", value: hash };
    return this;
  }

  /**
   * Set explicit time bounds. Both values are Unix timestamps (seconds).
   * Pass null for either to leave it unconstrained.
   */
  timebounds(minTime: number | null, maxTime: number | null): this {
    this._minTime = minTime;
    this._maxTime = maxTime;
    return this;
  }

  /** Append a Stellar operation. Can be called multiple times. */
  addOperation(op: Operation): this {
    this._operations.push(op);
    return this;
  }

  /** Skip simulation (useful for fee-bump or already-simulated transactions). */
  skipSimulation(): this {
    this._simulate = false;
    return this;
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  /**
   * Fetch the source account, apply all builder settings, optionally simulate,
   * and return the ready-to-sign transaction.
   */
  async build(): Promise<BuildResult> {
    if (!this._source) {
      throw new Error("FluentTransactionBuilder: source account is required. Call .source(address) first.");
    }

    const account = await this.rpc.getAccount(this._source);

    const txBuilder = new TransactionBuilder(account, {
      fee: this._fee.toString(),
      networkPassphrase: this._networkPassphrase,
    });

    for (const op of this._operations) {
      txBuilder.addOperation(op);
    }

    // Attach memo
    const memoObj = this.buildMemo();
    if (memoObj) {
      txBuilder.addMemo(memoObj);
    }

    // Timebounds: explicit bounds take priority over setTimeout
    if (this._minTime !== null || this._maxTime !== null) {
      txBuilder.setTimebounds(this._minTime ?? 0, this._maxTime ?? 0);
    } else {
      txBuilder.setTimeout(this._timeout);
    }

    let transaction = txBuilder.build();
    let simulation: SimulationResult | null = null;

    if (this._simulate) {
      simulation = await this.simulate(transaction);

      if (simulation.success) {
        const adjustedFee = Math.min(
          Math.max(this._fee, simulation.minResourceFee),
          this._maxFee,
        );
        // Rebuild with adjusted fee
        const adjustedBuilder = new TransactionBuilder(account, {
          fee: adjustedFee.toString(),
          networkPassphrase: this._networkPassphrase,
        });
        for (const op of this._operations) {
          adjustedBuilder.addOperation(op);
        }
        if (memoObj) adjustedBuilder.addMemo(memoObj);
        if (this._minTime !== null || this._maxTime !== null) {
          adjustedBuilder.setTimebounds(this._minTime ?? 0, this._maxTime ?? 0);
        } else {
          adjustedBuilder.setTimeout(this._timeout);
        }
        transaction = adjustedBuilder.build();
      }
    }

    return { transaction, simulation };
  }

  /**
   * Build and then sign the transaction with one or more Keypairs.
   * Returns the same BuildResult for chaining downstream submissions.
   */
  async buildAndSign(keypairs: Keypair | Keypair[]): Promise<BuildResult & { sign: () => void }> {
    const result = await this.build();
    const kps = Array.isArray(keypairs) ? keypairs : [keypairs];

    return {
      ...result,
      sign(): void {
        for (const kp of kps) {
          result.transaction.sign(kp);
        }
      },
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private buildMemo(): Memo | null {
    switch (this._memo.type) {
      case "text":
        return Memo.text(this._memo.value);
      case "id":
        return Memo.id(this._memo.value);
      case "hash":
        return Memo.hash(this._memo.value);
      case "return":
        return Memo.return(this._memo.value);
      case "none":
      default:
        return null;
    }
  }

  private async simulate(tx: Transaction): Promise<SimulationResult> {
    try {
      const raw = await this.rpc.simulateTransaction(tx);
      return {
        success: raw.success ?? false,
        fee: raw.fee ?? 0,
        resources: {
          cpu: raw.resources?.cpu ?? 0,
          memory: raw.resources?.memory ?? 0,
          readBytes: raw.resources?.readBytes ?? 0,
          writeBytes: raw.resources?.writeBytes ?? 0,
        },
        minResourceFee: raw.minResourceFee ?? 100,
        error: raw.error,
      };
    } catch (err: any) {
      return {
        success: false,
        fee: 0,
        resources: { cpu: 0, memory: 0, readBytes: 0, writeBytes: 0 },
        minResourceFee: 100,
        error: err?.message ?? "Simulation failed",
      };
    }
  }
}

// ── Factory shortcut ───────────────────────────────────────────────────────

/**
 * Create a FluentTransactionBuilder pre-configured for a source address.
 *
 * @example
 * const tx = await createTx(rpc)
 *   .source("G...")
 *   .memo("Payment for invoice #1")
 *   .addOperation(paymentOp)
 *   .build();
 */
export function createTx(rpc: RpcClient): FluentTransactionBuilder {
  return new FluentTransactionBuilder(rpc);
}
