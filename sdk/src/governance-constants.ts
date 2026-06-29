import { Networks } from "@stellar/stellar-sdk";

/** Read-only account address for governance simulations. */
export const GOVERNANCE_READ_ACCOUNT =
  "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

/** Default transaction timeout for governance operations (seconds). */
export const GOVERNANCE_TX_TIMEOUT_SEC = 30;

/** Contract ID for the governance contract on testnet. */
export const GOVERNANCE_TESTNET_CONTRACT_ID =
  "CD7GOIU3GNK7EZHG7XWBC7VI4NRVGMRCU7X2FOCAPQN6EGTSW46BY4EB";

/** Pre-configured testnet settings for the governance contract. */
export const GOVERNANCE_TESTNET: {
  contractId: string;
  rpcUrl: string;
  networkPassphrase: string;
} = {
  contractId: GOVERNANCE_TESTNET_CONTRACT_ID,
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
};

/** Map of governance contract method names. */
export const GovernanceContractMethod = {
  CreateProposal: "create_proposal",
  CastVote: "cast_vote",
  ExecuteProposal: "execute_proposal",
  VetoProposal: "veto_proposal",
  DelegateVotes: "delegate_votes",
  UndelegateVotes: "undelegate_votes",
  GetProposal: "get_proposal",
  ListProposals: "list_proposals",
} as const;

/** Type union of all governance contract method names. */
export type GovernanceContractMethodName =
  (typeof GovernanceContractMethod)[keyof typeof GovernanceContractMethod];

/** Expected byte length for governance description/reason hashes. */
export const HASH_BYTE_LENGTH = 32;
