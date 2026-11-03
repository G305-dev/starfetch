export function formatCurrencyMinor(value: number | null, currency: string | null) {
  if (value === null || !currency) return "—";

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  } catch {
    // Keep the API-supplied currency visible if it is not supported by Intl.
    return `${currency} ${(value / 100).toFixed(2)}`;
  }
}

export function formatNairaMinor(value: number | null) {
  return formatCurrencyMinor(value, "NGN");
}

export function formatDashboardDate(value: string | null) {
  if (!value) return "Date not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
