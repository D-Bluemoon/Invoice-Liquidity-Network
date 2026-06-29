/**
 * Enumeration of governance proposal action types.
 */
export enum ProposalActionKind {
  /** Update the protocol fee rate. */
  UpdateFeeRate = "UpdateFeeRate",
  /** Add a new token to the protocol. */
  AddToken = "AddToken",
  /** Remove a token from the protocol. */
  RemoveToken = "RemoveToken",
  /** Update the maximum discount rate. */
  UpdateMaxDiscountRate = "UpdateMaxDiscountRate",
}

/**
 * A governance proposal action with its parameters.
 * Discriminated union on the `kind` field.
 */
export type ProposalAction =
  | { kind: ProposalActionKind.UpdateFeeRate; rate: number }
  | { kind: ProposalActionKind.AddToken; tokenAddress: string }
  | { kind: ProposalActionKind.RemoveToken; tokenAddress: string }
  | { kind: ProposalActionKind.UpdateMaxDiscountRate; rate: number };

/**
 * Enumeration of governance proposal statuses.
 */
export enum ProposalStatus {
  Active = "Active",
  Passed = "Passed",
  Rejected = "Rejected",
  Executed = "Executed",
  Vetoed = "Vetoed",
}

/**
 * A governance proposal as returned by the contract.
 */
export interface GovernanceProposal {
  id: bigint;
  proposer: string;
  descriptionHash: Buffer;
  action: ProposalAction;
  proposedValue: bigint;
  status: ProposalStatus;
  votesFor: bigint;
  votesAgainst: bigint;
  createdAt: number;
  votingEnd: number;
  etaLedger: number;
}

/**
 * Parameters for creating a new governance proposal.
 */
export interface CreateProposalParams {
  proposer: string;
  action: ProposalAction;
  descriptionHash: Buffer | Uint8Array;
  proposedValue: bigint;
}

/**
 * Parameters for casting a vote on a governance proposal.
 */
export interface CastVoteParams {
  voter: string;
  proposalId: bigint;
  support: boolean;
}

/**
 * Parameters for executing a passed governance proposal.
 */
export interface ExecuteProposalParams {
  source: string;
  proposalId: bigint;
  totalSupply: bigint;
}

/**
 * Parameters for vetoing a governance proposal.
 */
export interface VetoProposalParams {
  admin: string;
  proposalId: bigint;
  reasonHash: Buffer | Uint8Array;
}

/**
 * Parameters for delegating voting power to another address.
 */
export interface DelegateVotesParams {
  delegator: string;
  delegate: string;
}

/**
 * Parameters for undelegating voting power.
 */
export interface UndelegateVotesParams {
  delegator: string;
}

/**
 * Parameters for fetching a specific governance proposal.
 */
export interface GetProposalParams {
  proposalId: bigint;
}

/**
 * Parameters for listing governance proposals with optional filters.
 */
export interface ListProposalsParams {
  status?: ProposalStatus;
  page?: number;
  pageSize?: number;
}

/**
 * Configuration for the GovernanceClient.
 */
import type { RpcServerLike } from "./types";

export interface GovernanceClientConfig {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
  server?: RpcServerLike;
}
