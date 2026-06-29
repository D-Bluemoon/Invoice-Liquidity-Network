import { nativeToScVal, rpc } from "@stellar/stellar-sdk";

import { GovernanceContractMethod } from "./governance-constants";
import type {
  CastVoteParams,
  CreateProposalParams,
  DelegateVotesParams,
  ExecuteProposalParams,
  GetProposalParams,
  GovernanceClientConfig,
  ListProposalsParams,
  UndelegateVotesParams,
  VetoProposalParams,
} from "./governance-types";
import {
  buildReadContractTransaction,
  buildWriteContractTransaction,
  encodeProposalAction,
  toAddressScVal,
  toBytesN32ScVal,
  toOptionalProposalStatusScVal,
  type BuiltTransaction,
} from "./governance-utils";
import type { RpcServerLike } from "./types";

/**
 * Client for interacting with the ILN governance contract.
 * Supports creating proposals, casting votes, executing proposals, and more.
 *
 * @example
 * ```ts
 * import { GovernanceClient, GOVERNANCE_TESTNET } from "@invoice-liquidity/sdk";
 *
 * const gov = new GovernanceClient(GOVERNANCE_TESTNET);
 * const tx = await gov.createProposal({
 *   proposer: "GABC...",
 *   action: { kind: ProposalActionKind.UpdateFeeRate, rate: 100 },
 *   descriptionHash: Buffer.from("..."),
 *   proposedValue: 100n,
 * });
 * ```
 */
export class GovernanceClient {
  private readonly contractId: string;
  private readonly networkPassphrase: string;
  private readonly server: RpcServerLike;

  constructor(config: GovernanceClientConfig) {
    this.contractId = config.contractId;
    this.networkPassphrase = config.networkPassphrase;
    this.server = config.server ?? new rpc.Server(config.rpcUrl);
  }

  /**
   * Create a new governance proposal.
   *
   * @param params - Proposal creation parameters.
   * @returns A built transaction ready for signing and submission.
   *
   * @example
   * ```ts
   * const tx = await gov.createProposal({
   *   proposer: "GABC...",
   *   action: { kind: ProposalActionKind.UpdateFeeRate, rate: 100 },
   *   descriptionHash: Buffer.from("..."),
   *   proposedValue: 100n,
   * });
   * ```
   */
  async createProposal(params: CreateProposalParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.proposer,
      GovernanceContractMethod.CreateProposal,
      [
        toAddressScVal(params.proposer),
        encodeProposalAction(params.action),
        toBytesN32ScVal(params.descriptionHash),
        nativeToScVal(params.proposedValue, { type: "i128" }),
      ],
    );
  }

  /**
   * Cast a vote on an active governance proposal.
   *
   * @param params - Vote casting parameters.
   * @returns A built transaction ready for signing and submission.
   */
  async castVote(params: CastVoteParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.voter,
      GovernanceContractMethod.CastVote,
      [
        toAddressScVal(params.voter),
        nativeToScVal(params.proposalId, { type: "u64" }),
        nativeToScVal(params.support, { type: "bool" }),
      ],
    );
  }

  /**
   * Execute a passed governance proposal.
   *
   * @param params - Execution parameters including proposal ID and total supply.
   * @returns A built transaction ready for signing and submission.
   */
  async executeProposal(params: ExecuteProposalParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.source,
      GovernanceContractMethod.ExecuteProposal,
      [
        nativeToScVal(params.proposalId, { type: "u64" }),
        nativeToScVal(params.totalSupply, { type: "i128" }),
      ],
    );
  }

  /**
   * Veto a governance proposal (admin-only).
   *
   * @param params - Veto parameters including proposal ID and reason hash.
   * @returns A built transaction ready for signing and submission.
   */
  async vetoProposal(params: VetoProposalParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.admin,
      GovernanceContractMethod.VetoProposal,
      [
        nativeToScVal(params.proposalId, { type: "u64" }),
        toBytesN32ScVal(params.reasonHash),
      ],
    );
  }

  /**
   * Delegate voting power to another address.
   *
   * @param params - Delegation parameters.
   * @returns A built transaction ready for signing and submission.
   */
  async delegateVotes(params: DelegateVotesParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.delegator,
      GovernanceContractMethod.DelegateVotes,
      [toAddressScVal(params.delegator), toAddressScVal(params.delegate)],
    );
  }

  /**
   * Undelegate voting power (revoke delegation).
   *
   * @param params - Undelegation parameters.
   * @returns A built transaction ready for signing and submission.
   */
  async undelegateVotes(params: UndelegateVotesParams): Promise<BuiltTransaction> {
    return buildWriteContractTransaction(
      this.server,
      this.contractId,
      this.networkPassphrase,
      params.delegator,
      GovernanceContractMethod.UndelegateVotes,
      [toAddressScVal(params.delegator)],
    );
  }

  /**
   * Build a read-only transaction to fetch a governance proposal.
   *
   * @param params - Query parameters with the proposal ID.
   * @returns A built transaction for simulation (read-only).
   */
  getProposal(params: GetProposalParams): BuiltTransaction {
    return buildReadContractTransaction(
      this.contractId,
      this.networkPassphrase,
      GovernanceContractMethod.GetProposal,
      [nativeToScVal(params.proposalId, { type: "u64" })],
    );
  }

  /**
   * Build a read-only transaction to list governance proposals with optional filters.
   *
   * @param params - Optional filter and pagination parameters.
   * @returns A built transaction for simulation (read-only).
   */
  listProposals(params: ListProposalsParams = {}): BuiltTransaction {
    const page = params.page ?? 0;
    const pageSize = params.pageSize ?? 20;

    return buildReadContractTransaction(
      this.contractId,
      this.networkPassphrase,
      GovernanceContractMethod.ListProposals,
      [
        toOptionalProposalStatusScVal(params.status),
        nativeToScVal(page, { type: "u32" }),
        nativeToScVal(pageSize, { type: "u32" }),
      ],
    );
  }
}

export {
  GovernanceContractMethod,
  GOVERNANCE_TESTNET,
  GOVERNANCE_TESTNET_CONTRACT_ID,
} from "./governance-constants";
export {
  ProposalActionKind,
  ProposalStatus,
  type CastVoteParams,
  type CreateProposalParams,
  type DelegateVotesParams,
  type ExecuteProposalParams,
  type GetProposalParams,
  type GovernanceClientConfig,
  type GovernanceProposal,
  type ListProposalsParams,
  type ProposalAction,
  type UndelegateVotesParams,
  type VetoProposalParams,
} from "./governance-types";
export {
  parseGovernanceProposal,
  parseGovernanceProposalListSimulation,
  parseGovernanceProposalSimulation,
} from "./governance-parser";
