/**
 * Formatting utilities for IST datetime, Indian currency, and phone masking.
 */

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format ISO date string into Indian Standard Time (IST) human-readable format.
 * Example: "24 Oct 2026, 02:45 PM IST"
 */
export function formatISTDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";

    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: IST_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);

    return `${formatted} IST`;
  } catch {
    return "-";
  }
}

/**
 * Format ISO date string into shorter IST time.
 * Example: "02:45:10 PM IST"
 */
export function formatISTTime(isoString: string | null | undefined): string {
  if (!isoString) return "-";
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return "-";

    const formatted = new Intl.DateTimeFormat("en-IN", {
      timeZone: IST_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }).format(date);

    return `${formatted} IST`;
  } catch {
    return "-";
  }
}

/**
 * Format number into Indian currency (₹) representation.
 * Example: 150000 -> "₹1,50,000"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Mask phone number showing only the last 4 digits.
 * Example: "+919876543210" -> "*********3210"
 * Example: "1234" -> "1234"
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.length <= 4) return phone;
  const lastFour = phone.slice(-4);
  const asterisks = "*".repeat(phone.length - 4);
  return `${asterisks}${lastFour}`;
}

/**
 * Format float to fixed decimals safely.
 */
export function formatDecimal(val: number | null | undefined, digits: number = 3): string {
  if (val === null || val === undefined || Number.isNaN(val)) return "-";
  return val.toFixed(digits);
}
