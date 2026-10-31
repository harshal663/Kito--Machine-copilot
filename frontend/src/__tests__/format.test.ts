import { describe, it, expect } from "vitest";
import { formatISTDateTime, formatISTTime, formatINR, maskPhone, formatDecimal } from "../lib/format";

describe("Formatting Utilities", () => {
  it("formatISTDateTime formats valid ISO timestamp into IST with timezone suffix", () => {
    // 2026-10-24T12:00:00Z -> IST is +05:30 -> 17:30 (05:30 PM)
    const result = formatISTDateTime("2026-10-24T12:00:00Z");
    expect(result).toContain("IST");
    expect(result).toContain("2026");
    expect(result).toContain("17:30");
  });

  it("formatISTDateTime returns '-' for null or invalid inputs", () => {
    expect(formatISTDateTime(null)).toBe("-");
    expect(formatISTDateTime(undefined)).toBe("-");
    expect(formatISTDateTime("invalid-date")).toBe("-");
  });

  it("formatISTTime formats valid ISO timestamp into IST time", () => {
    const result = formatISTTime("2026-10-24T12:00:00Z");
    expect(result).toContain("IST");
    expect(result).toContain("05:30");
  });

  it("formatINR formats numbers with Indian currency symbol", () => {
    const result = formatINR(150000);
    expect(result).toContain("₹");
    expect(result).toContain("1,50,000");
  });

  it("maskPhone masks leading digits keeping only the last 4 digits", () => {
    expect(maskPhone("+919876543210")).toBe("*********3210");
    expect(maskPhone("1234")).toBe("1234");
    expect(maskPhone("")).toBe("");
    expect(maskPhone(null)).toBe("");
  });

  it("formatDecimal formats floats to designated decimal precision", () => {
    expect(formatDecimal(0.12345, 3)).toBe("0.123");
    expect(formatDecimal(null)).toBe("-");
    expect(formatDecimal(undefined)).toBe("-");
    expect(formatDecimal(Number.NaN)).toBe("-");
  });
});
