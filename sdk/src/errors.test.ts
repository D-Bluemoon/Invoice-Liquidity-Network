import { describe, it, expect } from "vitest";
import {
  parseContractError,
  InvalidDiscountRateError,
  TokenMismatchError,
  PayerReputationTooLowError,
  GenericContractError,
  InsufficientBalanceError,
  NetworkError,
  TransactionFailedError,
  ValidationError,
  WalletNotConnectedError,
  ILNError,
} from "./errors";

describe("Error Mapping SDK", () => {
  it("maps InvalidDiscountRate", () => {
    const err = parseContractError("Error: InvalidDiscountRate");
    expect(err).toBeInstanceOf(InvalidDiscountRateError);
    expect(err.code).toBe("INVALID_DISCOUNT_RATE");
  });
  it("maps TokenMismatch", () => {
    const err = parseContractError("Error: TokenMismatch");
    expect(err).toBeInstanceOf(TokenMismatchError);
  });
  it("maps PayerReputationTooLow", () => {
    const err = parseContractError("Error: PayerReputationTooLow");
    expect(err).toBeInstanceOf(PayerReputationTooLowError);
  });
  it("maps generic errors", () => {
    const err = parseContractError("UnknownXDRCode");
    expect(err).toBeInstanceOf(GenericContractError);
  });

  describe("Structured SDK Error Classes", () => {
    it("preserves prototype chain for instanceof checks", () => {
      const balanceErr = new InsufficientBalanceError();
      const networkErr = new NetworkError();
      const txErr = new TransactionFailedError();
      const valErr = new ValidationError();
      const walletErr = new WalletNotConnectedError();

      expect(balanceErr).toBeInstanceOf(InsufficientBalanceError);
      expect(balanceErr).toBeInstanceOf(ILNError);
      expect(balanceErr).toBeInstanceOf(Error);

      expect(networkErr).toBeInstanceOf(NetworkError);
      expect(networkErr).toBeInstanceOf(ILNError);

      expect(txErr).toBeInstanceOf(TransactionFailedError);
      expect(txErr).toBeInstanceOf(ILNError);

      expect(valErr).toBeInstanceOf(ValidationError);
      expect(valErr).toBeInstanceOf(ILNError);

      expect(walletErr).toBeInstanceOf(WalletNotConnectedError);
      expect(walletErr).toBeInstanceOf(ILNError);
    });

    it("has unique programmatic error codes", () => {
      const balanceErr = new InsufficientBalanceError();
      const networkErr = new NetworkError();
      const txErr = new TransactionFailedError();
      const valErr = new ValidationError();
      const walletErr = new WalletNotConnectedError();

      const codes = [
        balanceErr.code,
        networkErr.code,
        txErr.code,
        valErr.code,
        walletErr.code,
      ];

      // Check unique codes
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(5);

      expect(balanceErr.code).toBe("INSUFFICIENT_BALANCE");
      expect(networkErr.code).toBe("NETWORK_ERROR");
      expect(txErr.code).toBe("TRANSACTION_FAILED");
      expect(valErr.code).toBe("VALIDATION_ERROR");
      expect(walletErr.code).toBe("WALLET_NOT_CONNECTED");
    });

    it("uses default descriptive messages and remediation strategies", () => {
      const balanceErr = new InsufficientBalanceError();
      expect(balanceErr.message).toBe("Insufficient balance to complete the transaction.");
      expect(balanceErr.remediation).toBe("Ensure the account has enough funds before retrying.");

      const networkErr = new NetworkError();
      expect(networkErr.message).toBe("Network request failed.");

      const valErr = new ValidationError();
      expect(valErr.message).toBe("Validation failed.");
    });

    it("supports overriding custom messages and remediation strategies", () => {
      const customMsg = "Custom validation error details";
      const customRemedy = "Please enter valid address string";
      const valErr = new ValidationError(customMsg, customRemedy);

      expect(valErr.message).toBe(customMsg);
      expect(valErr.remediation).toBe(customRemedy);
    });
  });
});
