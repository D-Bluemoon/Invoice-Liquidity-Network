import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCli } from "../cli";
import { ILNClient } from "../client";
import { LocalDevEnvironment } from "../dev-environment";
import { Writable } from "stream";

// Helper to capture stdout/stderr
function createStreamCapture() {
  let output = "";
  const stream = new Writable({
    write(chunk, encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });
  return {
    stream,
    getOutput: () => output,
  };
}

describe("CLI --json Output Consistency", () => {
  let stdout: ReturnType<typeof createStreamCapture>;
  let stderr: ReturnType<typeof createStreamCapture>;
  let mockDependencies: any;

  beforeEach(() => {
    stdout = createStreamCapture();
    stderr = createStreamCapture();
    
    // Provide mocked dependencies
    mockDependencies = {
      stdout: stdout.stream,
      stderr: stderr.stream,
      loadConfig: vi.fn().mockReturnValue({
        network: "testnet",
        rpcUrl: "http://localhost:8000",
        contractId: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        keypairPath: ".iln/keypair.txt"
      }),
      createClient: vi.fn().mockReturnValue({
        getInvoice: vi.fn().mockResolvedValue({
          id: 42n,
          status: "Pending",
          amount: 100n,
          amountFunded: 0n,
          discountRate: 500,
          dueDate: 1735689600n,
          freelancer: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          payer: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
          funder: null,
          token: "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
          fundedAt: null
        }),
        getInvoices: vi.fn().mockResolvedValue([]),
        getHistory: vi.fn().mockResolvedValue([]),
        submitInvoice: vi.fn().mockResolvedValue({ invoiceId: 43n, txHash: "somehash" }),
        fundInvoice: vi.fn().mockResolvedValue({ hash: "somehash" }),
        payInvoice: vi.fn().mockResolvedValue({ hash: "somehash" }),
      } as unknown as ILNClient),
      createDevEnvironment: vi.fn().mockReturnValue({
        status: vi.fn().mockResolvedValue({ running: true, network: "local" })
      } as unknown as LocalDevEnvironment)
    };
  });

  // Test the status command
  it("status command produces valid JSON with consistent shape", async () => {
    try {
      await runCli(["status", "--id", "42", "--json"], mockDependencies);
    } catch (e: any) {
      if (e.code !== "commander.helpDisplayed" && e.code !== "commander.help") {
        throw e;
      }
    }
    const output = stdout.getOutput().trim();
    expect(output).not.toBe("");
    
    const parsed = JSON.parse(output);
    // Either it should be wrapped { data: ... } or just raw object.
    // The goal of issue #704 is to establish a consistent top-level shape.
    expect(parsed).toHaveProperty("success");
    expect(parsed).toHaveProperty("data");
  });

  // Test the list command
  it("list command produces valid JSON with consistent shape", async () => {
    try {
      await runCli(["list", "--address", "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "--json"], mockDependencies);
    } catch (e: any) {
      if (e.code !== "commander.helpDisplayed" && e.code !== "commander.help") {
        throw e;
      }
    }
    const output = stdout.getOutput().trim();
    expect(output).not.toBe("");
    
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty("success");
    expect(parsed).toHaveProperty("data");
  });

  // Add more command tests here...
});
