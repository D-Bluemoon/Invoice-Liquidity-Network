import { ValidationError } from "./errors";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export interface StellarAddressValidationOptions {
  allowTestnet?: boolean;
  allowPublic?: boolean;
}

export interface AmountValidationOptions {
  min?: bigint;
  max?: bigint;
  decimals?: number;
  allowZero?: boolean;
}

export interface DateValidationOptions {
  min?: Date;
  max?: Date;
  allowPast?: boolean;
  allowFuture?: boolean;
}

export interface DiscountRateValidationOptions {
  min?: number;
  max?: number;
  allowZero?: boolean;
}

export class Validators {
  /**
   * Validate Stellar address format (G... or 56-character base32)
   */
  static validateStellarAddress(
    address: string,
    options: StellarAddressValidationOptions = {}
  ): ValidationResult {
    if (!address || typeof address !== "string") {
      return { isValid: false, error: "Address must be a non-empty string" };
    }

    // Stellar public key starts with 'G' and is 56 characters
    const stellarAddressRegex = /^G[A-Z0-9]{55}$/;
    
    if (!stellarAddressRegex.test(address)) {
      return { 
        isValid: false, 
        error: "Invalid Stellar address format. Must start with 'G' followed by 55 alphanumeric characters" 
      };
    }

    // Check if it's a valid base32 string
    try {
      const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      for (const char of address.slice(1)) {
        if (!base32Chars.includes(char)) {
          return { 
            isValid: false, 
            error: "Address contains invalid base32 characters" 
          };
        }
      }
    } catch {
      return { 
        isValid: false, 
        error: "Address contains invalid characters" 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate token amount
   */
  static validateAmount(
    amount: bigint | number | string,
    options: AmountValidationOptions = {}
  ): ValidationResult {
    let bigintAmount: bigint;

    // Convert to bigint
    if (typeof amount === "bigint") {
      bigintAmount = amount;
    } else if (typeof amount === "number") {
      if (!Number.isFinite(amount)) {
        return { isValid: false, error: "Amount must be a finite number" };
      }
      bigintAmount = BigInt(Math.floor(amount));
    } else if (typeof amount === "string") {
      try {
        bigintAmount = BigInt(amount);
      } catch {
        return { isValid: false, error: "Amount must be a valid integer string" };
      }
    } else {
      return { isValid: false, error: "Amount must be a bigint, number, or string" };
    }

    // Check zero
    if (!options.allowZero && bigintAmount === 0n) {
      return { isValid: false, error: "Amount cannot be zero" };
    }

    // Check negative
    if (bigintAmount < 0n) {
      return { isValid: false, error: "Amount cannot be negative" };
    }

    // Check min
    if (options.min !== undefined && bigintAmount < options.min) {
      return { 
        isValid: false, 
        error: `Amount must be at least ${options.min.toString()}` 
      };
    }

    // Check max
    if (options.max !== undefined && bigintAmount > options.max) {
      return { 
        isValid: false, 
        error: `Amount must be at most ${options.max.toString()}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate date/timestamp
   */
  static validateDate(
    date: Date | number | string,
    options: DateValidationOptions = {}
  ): ValidationResult {
    let dateObj: Date;

    // Convert to Date
    if (date instanceof Date) {
      dateObj = date;
    } else if (typeof date === "number") {
      if (date < 0) {
        return { isValid: false, error: "Timestamp cannot be negative" };
      }
      dateObj = new Date(date);
    } else if (typeof date === "string") {
      dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return { isValid: false, error: "Invalid date string format" };
      }
    } else {
      return { isValid: false, error: "Date must be a Date, number, or string" };
    }

    const now = new Date();

    // Check past
    if (!options.allowPast && dateObj < now) {
      return { isValid: false, error: "Date cannot be in the past" };
    }

    // Check future
    if (!options.allowFuture && dateObj > now) {
      return { isValid: false, error: "Date cannot be in the future" };
    }

    // Check min
    if (options.min && dateObj < options.min) {
      return { 
        isValid: false, 
        error: `Date must be after ${options.min.toISOString()}` 
      };
    }

    // Check max
    if (options.max && dateObj > options.max) {
      return { 
        isValid: false, 
        error: `Date must be before ${options.max.toISOString()}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate discount rate (basis points, e.g., 300 = 3%)
   */
  static validateDiscountRate(
    rate: number,
    options: DiscountRateValidationOptions = {}
  ): ValidationResult {
    if (typeof rate !== "number" || !Number.isFinite(rate)) {
      return { isValid: false, error: "Discount rate must be a finite number" };
    }

    // Check zero
    if (!options.allowZero && rate === 0) {
      return { isValid: false, error: "Discount rate cannot be zero" };
    }

    // Check negative
    if (rate < 0) {
      return { isValid: false, error: "Discount rate cannot be negative" };
    }

    // Check min
    if (options.min !== undefined && rate < options.min) {
      return { 
        isValid: false, 
        error: `Discount rate must be at least ${options.min}` 
      };
    }

    // Check max (typically 10000 = 100%)
    if (options.max !== undefined && rate > options.max) {
      return { 
        isValid: false, 
        error: `Discount rate must be at most ${options.max}` 
      };
    }

    // Default max check (100% = 10000 bps)
    if (options.max === undefined && rate > 10000) {
      return { 
        isValid: false, 
        error: "Discount rate cannot exceed 10000 (100%)" 
      };
    }

    return { isValid: true };
  }

  /**
   * Composite validator - runs multiple validators and returns first error
   */
  static validateComposite(
    value: unknown,
    validators: Array<(value: unknown) => ValidationResult>
  ): ValidationResult {
    for (const validator of validators) {
      const result = validator(value);
      if (!result.isValid) {
        return result;
      }
    }
    return { isValid: true };
  }

  /**
   * Validate invoice submission parameters
   */
  static validateInvoiceSubmission(params: {
    freelancer: string;
    payer: string;
    amount: bigint;
    dueDate: number;
    discountRate: number;
  }): ValidationResult {
    const addressResult = this.validateStellarAddress(params.freelancer);
    if (!addressResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid freelancer address: ${addressResult.error}` 
      };
    }

    const payerResult = this.validateStellarAddress(params.payer);
    if (!payerResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid payer address: ${payerResult.error}` 
      };
    }

    const amountResult = this.validateAmount(params.amount, { allowZero: false });
    if (!amountResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid amount: ${amountResult.error}` 
      };
    }

    const dateResult = this.validateDate(params.dueDate, { allowPast: false });
    if (!dateResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid due date: ${dateResult.error}` 
      };
    }

    const rateResult = this.validateDiscountRate(params.discountRate, { 
      min: 0, 
      max: 10000,
      allowZero: false 
    });
    if (!rateResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid discount rate: ${rateResult.error}` 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate funding parameters
   */
  static validateFunding(params: {
    funder: string;
    invoiceId: bigint;
  }): ValidationResult {
    const addressResult = this.validateStellarAddress(params.funder);
    if (!addressResult.isValid) {
      return { 
        isValid: false, 
        error: `Invalid funder address: ${addressResult.error}` 
      };
    }

    if (params.invoiceId < 0n) {
      return { 
        isValid: false, 
        error: "Invoice ID cannot be negative" 
      };
    }

    return { isValid: true };
  }

  /**
   * Validate payment parameters
   */
  static validatePayment(params: {
    invoiceId: bigint;
  }): ValidationResult {
    if (params.invoiceId < 0n) {
      return { 
        isValid: false, 
        error: "Invoice ID cannot be negative" 
      };
    }

    return { isValid: true };
  }

  /**
   * Helper to throw ValidationError if validation fails
   */
  static assertValid(result: ValidationResult, context?: string): void {
    if (!result.isValid) {
      throw new ValidationError(
        context ? `${context}: ${result.error}` : result.error
      );
    }
  }
}
