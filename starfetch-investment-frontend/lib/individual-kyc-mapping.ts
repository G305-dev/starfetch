export const investmentObjectiveToWire = {
  "Capital preservation": "CAPITAL_PRESERVATION",
  Income: "INCOME",
  Balanced: "BALANCED",
  Growth: "GROWTH",
} as const;

export const riskToleranceToWire = {
  Conservative: "CONSERVATIVE",
  Moderate: "MODERATE",
  Balanced: "BALANCED",
  Aggressive: "AGGRESSIVE",
} as const;

export const investmentKnowledgeToWire = {
  None: "NONE",
  Limited: "LIMITED",
  Good: "GOOD",
  Extensive: "EXTENSIVE",
} as const;

export const investmentHorizonToWire = {
  "180 days": "DAYS_180",
  "365 days": "DAYS_365",
  "1–3 years": "YEARS_1_TO_3",
  "3–5 years": "YEARS_3_TO_5",
  "5 years +": "YEARS_5_PLUS",
} as const;

export const sourceOfFundsToWire = {
  "Salary / employment": "SALARY_EMPLOYMENT",
  "Business income": "BUSINESS_INCOME",
  "Sale of assets": "SALE_OF_ASSETS",
  "Inheritance / gift": "INHERITANCE_GIFT",
  Savings: "SAVINGS",
  "Pension / retirement": "PENSION_RETIREMENT",
  "Investment proceeds": "INVESTMENT_PROCEEDS",
  "Other (specify)": "OTHER",
} as const;

export type WireValue<T extends Record<string, string>> = T[keyof T];

export function labelToWire<T extends Record<string, string>>(mapping: T, label: string): WireValue<T> | null {
  return Object.prototype.hasOwnProperty.call(mapping, label) ? mapping[label as keyof T] as WireValue<T> : null;
}

export function wireToLabel<T extends Record<string, string>>(mapping: T, wireValue: string | null | undefined): string {
  if (!wireValue) return "";
  return Object.entries(mapping).find(([, value]) => value === wireValue)?.[0] ?? "";
}

/** Convert a user-entered Naira amount to the API's integer-kobo digit string without floats. */
export function nairaToMinorUnits(value: string): string | null {
  const normalized = value.trim().replace(/^₦\s*/, "").replace(/\s+/g, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(normalized)) return null;

  const [wholePart, fractionPart = ""] = normalized.replace(/,/g, "").split(".");
  const digits = `${wholePart}${(fractionPart + "00").slice(0, 2)}`.replace(/^0+(?=\d)/, "");
  return digits || "0";
}

/** Render an API minor-unit digit string as a precise Naira input value without floating-point arithmetic. */
export function minorUnitsToNaira(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const rawDigits = String(value);
  if (!/^\d+$/.test(rawDigits)) return "";
  const digits = rawDigits.replace(/^0+(?=\d)/, "");
  const padded = digits.padStart(3, "0");
  const naira = padded.slice(0, -2).replace(/^0+(?=\d)/, "");
  const fraction = padded.slice(-2).replace(/0+$/, "");
  return fraction ? `${naira}.${fraction}` : naira;
}

export function sourceLabelsToWire(labels: readonly string[]): string[] | null {
  const values: string[] = [];
  for (const label of labels) {
    const value = labelToWire(sourceOfFundsToWire, label);
    if (!value) return null;
    values.push(value);
  }
  return values;
}

export function sourceWireToLabels(values: readonly string[]): string[] {
  return values.flatMap((value) => {
    const label = wireToLabel(sourceOfFundsToWire, value);
    return label ? [label] : [];
  });
}
