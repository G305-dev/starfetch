export type FixedNoteTenor = "180" | "365";

export type FixedNoteRateBand = {
  id: "tier-1" | "tier-2" | "tier-3" | "tier-4" | "tier-5";
  tier: string;
  band: string;
  rate180: string;
  rate365: string;
};

/** Frontend-only indicative rate-card data for Starfetch Fixed Note enquiries. */
export const fixedNoteRateBands: FixedNoteRateBand[] = [
  { id: "tier-1", tier: "Tier 1", band: "₦10m – ₦24.9m", rate180: "18.0%", rate365: "19.0%" },
  { id: "tier-2", tier: "Tier 2", band: "₦25m – ₦49.9m", rate180: "19.25%", rate365: "20.25%" },
  { id: "tier-3", tier: "Tier 3", band: "₦50m – ₦99.9m", rate180: "20.5%", rate365: "21.5%" },
  { id: "tier-4", tier: "Tier 4", band: "₦100m – ₦499.9m", rate180: "21.75%", rate365: "22.5%" },
  { id: "tier-5", tier: "Tier 5", band: "₦500m and above", rate180: "22.75%", rate365: "24.0%" },
];

export const fixedNoteTerms = {
  minimum: "₦10,000,000",
  tenor: "180 or 365 days",
  interest: "Gross, paid at maturity",
  rollover: "Automatic",
};
