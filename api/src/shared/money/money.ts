import { currencyExponent, formatMoneyForDisplay } from './currency';

/**
 * Integer minor units plus an explicit currency. Arithmetic across currencies throws, and there
 * is no float path in or out: conversion between currencies lives in fx.ts with explicit rounding.
 */
export class Money {
  private constructor(
    readonly amountMinor: bigint,
    readonly currency: string,
  ) {}

  static of(amountMinor: bigint, currency: string): Money {
    currencyExponent(currency); // throws for unknown currencies
    return new Money(amountMinor, currency);
  }

  static rwf(amount: bigint | number): Money {
    if (typeof amount === 'number' && !Number.isSafeInteger(amount)) {
      throw new Error('RWF amounts must be safe integers');
    }
    return new Money(BigInt(amount), 'RWF');
  }

  static zero(currency: string): Money {
    return Money.of(0n, currency);
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  isNegative(): boolean {
    return this.amountMinor < 0n;
  }

  isZero(): boolean {
    return this.amountMinor === 0n;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor === other.amountMinor) {
      return 0;
    }
    return this.amountMinor < other.amountMinor ? -1 : 1;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  /** JSON-safe integer; amounts are bounded by limits far below Number.MAX_SAFE_INTEGER. */
  toSafeNumber(): number {
    const value = Number(this.amountMinor);
    if (!Number.isSafeInteger(value)) {
      throw new Error('Amount exceeds the JSON-safe integer range');
    }
    return value;
  }

  display(): string {
    return formatMoneyForDisplay(this.amountMinor, this.currency);
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

/** bigint → number at the API boundary, with an explicit safety check. */
export function toSafeNumber(value: bigint): number {
  const converted = Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new Error('Value exceeds the JSON-safe integer range');
  }
  return converted;
}
