const MINOR_UNIT_SCALE = 100;

/**
 * Formats server minor units without first converting the full value to a
 * floating-point major-unit amount. The API client accepts only safe integers;
 * malformed or precision-unsafe values remain unavailable rather than being
 * silently rounded into a financial display.
 */
export function formatCurrencyMinor(value: number | null, currency: string | null) {
  if (value === null || !currency || !Number.isSafeInteger(value)) return "Not available";

  const negative = value < 0;
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / MINOR_UNIT_SCALE);
  const fraction = absolute % MINOR_UNIT_SCALE;
  const fractionText = String(fraction).padStart(2, "0");

  try {
    const wholeText = new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(whole);
    return `${negative ? "-" : ""}${wholeText}.${fractionText}`;
  } catch {
    const wholeText = new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(whole);
    return `${negative ? "-" : ""}${currency} ${wholeText}.${fractionText}`;
  }
}

export function formatNairaMinor(value: number | null) {
  return formatCurrencyMinor(value, "NGN");
}

export function formatDashboardDate(value: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not available";
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
