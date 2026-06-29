import { describe, it, expect } from "vitest";
import { Validators } from "./validators";
import { ValidationError } from "./errors";

describe("Validators", () => {
  describe("validateStellarAddress", () => {
    it("should validate correct Stellar addresses", () => {
      const result = Validators.validateStellarAddress("GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should reject empty address", () => {
      const result = Validators.validateStellarAddress("");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("non-empty string");
    });

    it("should reject non-string input", () => {
      const result = Validators.validateStellarAddress(123 as any);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("non-empty string");
    });

    it("should reject address without G prefix", () => {
      const result = Validators.validateStellarAddress("ABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("start with 'G'");
    });

    it("should reject address with wrong length", () => {
      const result = Validators.validateStellarAddress("GABCD");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("56 characters");
    });

    it("should reject address with invalid characters", () => {
      const result = Validators.validateStellarAddress("GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ123456789g");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("invalid base32 characters");
    });
  });

  describe("validateAmount", () => {
    it("should validate bigint amounts", () => {
      const result = Validators.validateAmount(1000n);
      expect(result.isValid).toBe(true);
    });

    it("should validate number amounts", () => {
      const result = Validators.validateAmount(1000);
      expect(result.isValid).toBe(true);
    });

    it("should validate string amounts", () => {
      const result = Validators.validateAmount("1000");
      expect(result.isValid).toBe(true);
    });

    it("should reject zero when not allowed", () => {
      const result = Validators.validateAmount(0n);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be zero");
    });

    it("should allow zero when explicitly allowed", () => {
      const result = Validators.validateAmount(0n, { allowZero: true });
      expect(result.isValid).toBe(true);
    });

    it("should reject negative amounts", () => {
      const result = Validators.validateAmount(-100n);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });

    it("should reject infinite numbers", () => {
      const result = Validators.validateAmount(Infinity);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("finite number");
    });

    it("should reject invalid string amounts", () => {
      const result = Validators.validateAmount("abc");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("valid integer string");
    });

    it("should enforce minimum", () => {
      const result = Validators.validateAmount(50n, { min: 100n });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least 100");
    });

    it("should enforce maximum", () => {
      const result = Validators.validateAmount(200n, { max: 100n });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at most 100");
    });

    it("should accept amount within range", () => {
      const result = Validators.validateAmount(50n, { min: 10n, max: 100n });
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateDate", () => {
    it("should validate Date objects", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = Validators.validateDate(futureDate);
      expect(result.isValid).toBe(true);
    });

    it("should validate timestamp numbers", () => {
      const futureTimestamp = Date.now() + 86400000;
      const result = Validators.validateDate(futureTimestamp);
      expect(result.isValid).toBe(true);
    });

    it("should validate date strings", () => {
      const result = Validators.validateDate("2025-12-31");
      expect(result.isValid).toBe(true);
    });

    it("should reject negative timestamps", () => {
      const result = Validators.validateDate(-1);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });

    it("should reject invalid date strings", () => {
      const result = Validators.validateDate("invalid-date");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Invalid date string");
    });

    it("should reject past dates when not allowed", () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = Validators.validateDate(pastDate);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be in the past");
    });

    it("should allow past dates when explicitly allowed", () => {
      const pastDate = new Date(Date.now() - 86400000);
      const result = Validators.validateDate(pastDate, { allowPast: true });
      expect(result.isValid).toBe(true);
    });

    it("should reject future dates when not allowed", () => {
      const futureDate = new Date(Date.now() + 86400000);
      const result = Validators.validateDate(futureDate, { allowFuture: false });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be in the future");
    });

    it("should enforce minimum date", () => {
      const minDate = new Date("2025-01-01");
      const earlierDate = new Date("2024-12-31");
      const result = Validators.validateDate(earlierDate, { min: minDate });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("after");
    });

    it("should enforce maximum date", () => {
      const maxDate = new Date("2025-12-31");
      const laterDate = new Date("2026-01-01");
      const result = Validators.validateDate(laterDate, { max: maxDate });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("before");
    });
  });

  describe("validateDiscountRate", () => {
    it("should validate valid discount rates", () => {
      const result = Validators.validateDiscountRate(300);
      expect(result.isValid).toBe(true);
    });

    it("should reject non-finite numbers", () => {
      const result = Validators.validateDiscountRate(Infinity);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("finite number");
    });

    it("should reject zero when not allowed", () => {
      const result = Validators.validateDiscountRate(0);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be zero");
    });

    it("should allow zero when explicitly allowed", () => {
      const result = Validators.validateDiscountRate(0, { allowZero: true });
      expect(result.isValid).toBe(true);
    });

    it("should reject negative rates", () => {
      const result = Validators.validateDiscountRate(-100);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });

    it("should enforce minimum", () => {
      const result = Validators.validateDiscountRate(50, { min: 100 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at least 100");
    });

    it("should enforce maximum", () => {
      const result = Validators.validateDiscountRate(500, { max: 300 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("at most 300");
    });

    it("should default max to 10000 (100%)", () => {
      const result = Validators.validateDiscountRate(15000);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot exceed 10000");
    });

    it("should accept rate within range", () => {
      const result = Validators.validateDiscountRate(300, { min: 0, max: 10000 });
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateComposite", () => {
    it("should pass when all validators pass", () => {
      const result = Validators.validateComposite("test", [
        (val) => ({ isValid: true }),
        (val) => ({ isValid: true }),
      ]);
      expect(result.isValid).toBe(true);
    });

    it("should fail on first validation error", () => {
      const result = Validators.validateComposite("test", [
        (val) => ({ isValid: false, error: "First error" }),
        (val) => ({ isValid: false, error: "Second error" }),
      ]);
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("First error");
    });

    it("should handle empty validator array", () => {
      const result = Validators.validateComposite("test", []);
      expect(result.isValid).toBe(true);
    });
  });

  describe("validateInvoiceSubmission", () => {
    it("should validate valid invoice submission", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        payer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891",
        amount: 1000n,
        dueDate: Math.floor(Date.now() / 1000) + 86400,
        discountRate: 300,
      });
      expect(result.isValid).toBe(true);
    });

    it("should reject invalid freelancer address", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "invalid",
        payer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891",
        amount: 1000n,
        dueDate: Math.floor(Date.now() / 1000) + 86400,
        discountRate: 300,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("freelancer address");
    });

    it("should reject invalid payer address", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        payer: "invalid",
        amount: 1000n,
        dueDate: Math.floor(Date.now() / 1000) + 86400,
        discountRate: 300,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("payer address");
    });

    it("should reject zero amount", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        payer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891",
        amount: 0n,
        dueDate: Math.floor(Date.now() / 1000) + 86400,
        discountRate: 300,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("amount");
    });

    it("should reject past due date", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        payer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891",
        amount: 1000n,
        dueDate: Math.floor(Date.now() / 1000) - 86400,
        discountRate: 300,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("due date");
    });

    it("should reject invalid discount rate", () => {
      const result = Validators.validateInvoiceSubmission({
        freelancer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        payer: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567891",
        amount: 1000n,
        dueDate: Math.floor(Date.now() / 1000) + 86400,
        discountRate: 15000,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("discount rate");
    });
  });

  describe("validateFunding", () => {
    it("should validate valid funding parameters", () => {
      const result = Validators.validateFunding({
        funder: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        invoiceId: 1n,
      });
      expect(result.isValid).toBe(true);
    });

    it("should reject invalid funder address", () => {
      const result = Validators.validateFunding({
        funder: "invalid",
        invoiceId: 1n,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("funder address");
    });

    it("should reject negative invoice ID", () => {
      const result = Validators.validateFunding({
        funder: "GABCD1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
        invoiceId: -1n,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });
  });

  describe("validatePayment", () => {
    it("should validate valid payment parameters", () => {
      const result = Validators.validatePayment({
        invoiceId: 1n,
      });
      expect(result.isValid).toBe(true);
    });

    it("should reject negative invoice ID", () => {
      const result = Validators.validatePayment({
        invoiceId: -1n,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("cannot be negative");
    });
  });

  describe("assertValid", () => {
    it("should not throw when validation passes", () => {
      expect(() => {
        Validators.assertValid({ isValid: true });
      }).not.toThrow();
    });

    it("should throw ValidationError when validation fails", () => {
      expect(() => {
        Validators.assertValid({ isValid: false, error: "Test error" });
      }).toThrow(ValidationError);
      expect(() => {
        Validators.assertValid({ isValid: false, error: "Test error" });
      }).toThrow("Test error");
    });

    it("should include context in error message when provided", () => {
      expect(() => {
        Validators.assertValid({ isValid: false, error: "Test error" }, "submitInvoice");
      }).toThrow("submitInvoice: Test error");
    });
  });
});
