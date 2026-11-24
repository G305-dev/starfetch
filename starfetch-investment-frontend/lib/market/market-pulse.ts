import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * Market Pulse — MANUALLY MAINTAINED official indicators.
 *
 * Values live in `public/data/market-pulse.json` and are read here at render
 * time. They are NOT live, not real-time and not from an external API. Every
 * indicator keeps its own reporting period and verification date so a visitor
 * can tell exactly what they are looking at.
 *
 * WHY THE FILE IS READ WITH `fs` AND NOT FETCHED FROM /public:
 * a malformed or missing file then degrades to an explicit unavailable state
 * instead of breaking the homepage, and a bad edit cannot ship silently.
 *
 * WHY THE PATH IS RESOLVED AGAINST SEVERAL ROOTS:
 * V1 used `process.cwd()` alone. That happens to be the project root under
 * `next dev` and under a normal `next start`, so the defect was invisible in
 * development — but it is NOT guaranteed in every deployment shape. Under a
 * standalone build (`output: "standalone"`) the server is started from
 * `.next/standalone`, where `public/` is *not* copied automatically, so a
 * cwd-relative read returns ENOENT and the card would silently render
 * "unavailable" in production while working perfectly on a developer machine.
 *
 * The read now tries an ordered list of candidate roots and reports WHICH one
 * worked, so the deployed environment can be verified (see
 * `scripts/market-pulse-deploy-check.cjs` and `MARKET_PULSE_ENVIRONMENT.md`).
 */

export type MarketPulseIndicatorId = "headline-inflation" | "monetary-policy-rate" | "cash-reserve-ratio";

export type MarketPulseIndicator = {
  id: MarketPulseIndicatorId;
  label: string;
  value: number;
  unit: string;
  reportingPeriod: string;
  previousValue: number | null;
  previousPeriod: string | null;
  appliesTo: string | null;
  note: string;
  source: string;
  sourceUrl: string;
  lastVerified: string;
};

export type MarketPulseFile = {
  indicators: MarketPulseIndicator[];
  lastVerified: string;
  updateProcess: string;
  disclaimer: string;
};

export type MarketPulseResult =
  | { status: "ready"; data: MarketPulseFile }
  | { status: "unavailable"; note: string };

export const MARKET_PULSE_FILE = "public/data/market-pulse.json";

/** The three indicators the homepage must show, in display order. */
export const MARKET_PULSE_ORDER: readonly MarketPulseIndicatorId[] = [
  "headline-inflation",
  "monetary-policy-rate",
  "cash-reserve-ratio",
];

/**
 * Candidate absolute paths for the JSON file, in priority order.
 *
 * - `MARKET_PULSE_FILE_PATH` (env) wins, so an operator can pin the path for an
 *   unusual deployment without a code change.
 * - `process.cwd()` covers `next dev`, `next start` and Vercel's build output.
 * - `.next/standalone` covers a standalone build started from its own directory.
 * - one level up covers a standalone build started from the project root.
 */
export function marketPulseCandidatePaths(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const candidates: string[] = [];
  const override = env.MARKET_PULSE_FILE_PATH;
  if (override && override.trim()) candidates.push(resolve(override.trim()));
  candidates.push(join(cwd, MARKET_PULSE_FILE));
  candidates.push(join(cwd, ".next/standalone", MARKET_PULSE_FILE));
  candidates.push(join(cwd, "..", MARKET_PULSE_FILE));
  // Deduplicate while preserving priority order.
  return Array.from(new Set(candidates));
}

export type MarketPulseLoad = MarketPulseResult & {
  /** Which candidate path actually served the file; null on failure. */
  sourcePath?: string | null;
  /** All candidates that were attempted, for diagnostics. */
  attemptedPaths?: string[];
};

/**
 * Validates a parsed JSON document. Rejects anything that would render a
 * half-truth: a number that is not a number, a missing reporting period, a
 * missing source, or a missing verification date.
 */
export function validateMarketPulse(raw: unknown): MarketPulseResult {
  if (raw === null || typeof raw !== "object") {
    return { status: "unavailable", note: "The Market Pulse data file could not be read." };
  }
  const file = raw as Partial<MarketPulseFile>;
  if (!Array.isArray(file.indicators)) {
    return { status: "unavailable", note: "The Market Pulse data file has no indicators." };
  }

  const byId = new Map<string, MarketPulseIndicator>();
  for (const entry of file.indicators) {
    if (!entry || typeof entry !== "object") continue;
    const indicator = entry as Partial<MarketPulseIndicator>;
    if (typeof indicator.id !== "string" || typeof indicator.value !== "number" || !Number.isFinite(indicator.value)) continue;
    if (typeof indicator.reportingPeriod !== "string" || !indicator.reportingPeriod.trim()) continue;
    if (typeof indicator.source !== "string" || !indicator.source.trim()) continue;
    if (typeof indicator.lastVerified !== "string" || !indicator.lastVerified.trim()) continue;
    byId.set(indicator.id, {
      id: indicator.id as MarketPulseIndicatorId,
      label: typeof indicator.label === "string" && indicator.label.trim() ? indicator.label.trim() : indicator.id,
      value: indicator.value,
      unit: typeof indicator.unit === "string" ? indicator.unit : "%",
      reportingPeriod: indicator.reportingPeriod.trim(),
      previousValue: typeof indicator.previousValue === "number" && Number.isFinite(indicator.previousValue) ? indicator.previousValue : null,
      previousPeriod: typeof indicator.previousPeriod === "string" && indicator.previousPeriod.trim() ? indicator.previousPeriod.trim() : null,
      appliesTo: typeof indicator.appliesTo === "string" && indicator.appliesTo.trim() ? indicator.appliesTo.trim() : null,
      note: typeof indicator.note === "string" ? indicator.note : "",
      source: indicator.source.trim(),
      sourceUrl: typeof indicator.sourceUrl === "string" ? indicator.sourceUrl : "",
      lastVerified: indicator.lastVerified.trim(),
    });
  }

  const ordered: MarketPulseIndicator[] = [];
  for (const id of MARKET_PULSE_ORDER) {
    const indicator = byId.get(id);
    if (indicator) ordered.push(indicator);
  }
  // Exactly three: if any configured indicator is missing or invalid the card
  // says so rather than silently showing two.
  if (ordered.length !== MARKET_PULSE_ORDER.length) {
    return {
      status: "unavailable",
      note: "Market Pulse is temporarily unavailable while its data file is being updated.",
    };
  }

  return {
    status: "ready",
    data: {
      indicators: ordered,
      lastVerified: typeof file.lastVerified === "string" ? file.lastVerified : ordered[0].lastVerified,
      updateProcess: typeof file.updateProcess === "string" ? file.updateProcess : "",
      disclaimer: typeof file.disclaimer === "string" ? file.disclaimer : "",
    },
  };
}

/**
 * Reads and validates the JSON, trying each candidate root in turn.
 *
 * Never throws. The returned value records which path served the file so a
 * deployment problem is diagnosable rather than presenting as a silent
 * "temporarily unavailable" card.
 */
export async function loadMarketPulse(
  cwd: string = process.cwd(),
  env: NodeJS.ProcessEnv = process.env,
): Promise<MarketPulseLoad> {
  const attemptedPaths = marketPulseCandidatePaths(cwd, env);

  for (const path of attemptedPaths) {
    try {
      const raw = await readFile(path, "utf8");
      const validated = validateMarketPulse(JSON.parse(raw));
      if (validated.status === "ready") {
        return { ...validated, sourcePath: path, attemptedPaths };
      }
      // The file was found but is invalid. Every candidate resolves to the same
      // file content, so stop here rather than reporting the next ENOENT and
      // hiding a genuine data problem behind a path problem.
      return { ...validated, sourcePath: path, attemptedPaths };
    } catch {
      // Missing or unreadable at this root — try the next one.
      continue;
    }
  }

  return {
    status: "unavailable",
    note: "Market Pulse is temporarily unavailable while its data file is being read.",
    sourcePath: null,
    attemptedPaths,
  };
}

/** Formats an indicator value with its unit, e.g. `14.06%`. */
export function formatPulseValue(indicator: Pick<MarketPulseIndicator, "value" | "unit">): string {
  return `${indicator.value}${indicator.unit}`;
}
