import { describe, it, expect } from "vitest";
import { generateBashCompletion, generateZshCompletion } from "../src/completion";

describe("Shell Completion", () => {
  describe("generateBashCompletion", () => {
    it("should return a valid bash script", () => {
      const script = generateBashCompletion();

      expect(script).toContain("#!/usr/bin/env bash");
      expect(script).toContain("_iln_completions");
      expect(script).toContain("complete -F _iln_completions iln");
    });

    it("should include all commands", () => {
      const script = generateBashCompletion();

      expect(script).toContain("submit");
      expect(script).toContain("fund");
      expect(script).toContain("pay");
      expect(script).toContain("status");
      expect(script).toContain("list");
      expect(script).toContain("history");
      expect(script).toContain("config");
      expect(script).toContain("compat");
      expect(script).toContain("xdr");
      expect(script).toContain("dashboard");
      expect(script).toContain("dev");
    });

    it("should include submit options", () => {
      const script = generateBashCompletion();

      expect(script).toContain("--payer");
      expect(script).toContain("--amount");
      expect(script).toContain("--due");
      expect(script).toContain("--rate");
      expect(script).toContain("--token");
    });

    it("should include history options", () => {
      const script = generateBashCompletion();

      expect(script).toContain("--address");
      expect(script).toContain("--action");
      expect(script).toContain("--limit");
      expect(script).toContain("--format");
    });

    it("should include dev subcommands", () => {
      const script = generateBashCompletion();

      expect(script).toContain("start");
      expect(script).toContain("stop");
      expect(script).toContain("reset");
      expect(script).toContain("seed");
    });
  });

  describe("generateZshCompletion", () => {
    it("should return a valid zsh script", () => {
      const script = generateZshCompletion();

      expect(script).toContain("#compdef iln");
      expect(script).toContain("_iln()");
    });

    it("should include all commands with descriptions", () => {
      const script = generateZshCompletion();

      expect(script).toContain("submit:Submit a new invoice");
      expect(script).toContain("fund:Fund an invoice");
      expect(script).toContain("pay:Mark an invoice as paid");
      expect(script).toContain("status:Show invoice status");
      expect(script).toContain("list:List invoices by address");
      expect(script).toContain("history:Show invoice history");
      expect(script).toContain("config:Show protocol configuration");
      expect(script).toContain("compat:SDK and contract compatibility utilities");
      expect(script).toContain("xdr:Inspect Soroban XDR values");
      expect(script).toContain("dashboard:Launch real-time dashboard");
      expect(script).toContain("dev:Development utilities");
    });

    it("should include dev subcommands", () => {
      const script = generateZshCompletion();

      expect(script).toContain("start:Start local development environment");
      expect(script).toContain("stop:Stop local development environment");
      expect(script).toContain("reset:Reset local development environment");
      expect(script).toContain("status:Show local environment status");
      expect(script).toContain("seed:Create and fund testnet accounts");
    });

    it("should include history options with action choices", () => {
      const script = generateZshCompletion();

      expect(script).toContain("--action");
      expect(script).toContain("submit fund pay");
      expect(script).toContain("--format");
      expect(script).toContain("table json");
    });

    it("should include seed options with scenario choices", () => {
      const script = generateZshCompletion();

      expect(script).toContain("--scenario");
      expect(script).toContain("new-user active-lp disputed");
      expect(script).toContain("--token");
      expect(script).toContain("USDC EURC");
    });
  });
});
