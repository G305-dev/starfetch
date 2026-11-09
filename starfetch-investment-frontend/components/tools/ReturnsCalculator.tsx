"use client";

import { type FormEvent, useState } from "react";
import {
  calculateReturnsProjection,
  formatProjectionNairaMinor,
  formatProjectionPercent,
  parseAnnualManagementFeePercent,
  parseAnnualReturnPercent,
  parseInvestmentPeriodMonths,
  parseRequiredNairaToMinor,
  type ReturnsInputs,
  type ReturnsProjection,
} from "@/lib/tools/returns";

type ReturnField = "startingAmount" | "monthlyContribution" | "investmentPeriod" | "annualReturn" | "annualManagementFee";
type FormValues = Record<ReturnField, string>;
type FormErrors = Partial<Record<ReturnField, string>>;

type FieldDefinition = {
  key: ReturnField;
  label: string;
  min?: string;
  max?: string;
  step?: string;
  supportingText?: string;
};

const fields: FieldDefinition[] = [
  { key: "startingAmount", label: "Starting amount (₦)", min: "0", step: "0.01" },
  { key: "monthlyContribution", label: "Monthly contribution (₦)", min: "0", step: "0.01" },
  { key: "investmentPeriod", label: "Investment period (years)", min: "0.01", max: "100", step: "0.01" },
  {
    key: "annualReturn",
    label: "Assumed annual return (%)",
    min: "-99.99",
    max: "1000",
    step: "0.01",
    supportingText: "You choose the assumption. Compare a savings-account rate against an investment rate to see the gap.",
  },
  { key: "annualManagementFee", label: "Annual management fee (%)", min: "0", max: "100", step: "0.01" },
];

const initialValues: FormValues = {
  startingAmount: "500000",
  monthlyContribution: "50000",
  investmentPeriod: "5",
  annualReturn: "15",
  annualManagementFee: "1.5",
};

export function ReturnsCalculator() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<ReturnsProjection | null>(null);

  function updateValue(key: ReturnField, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const { [key]: removed, ...remaining } = current;
      return remaining;
    });
    setFormError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FormErrors = {};
    const parsed = {} as ReturnsInputs;

    const startingAmount = parseRequiredNairaToMinor(values.startingAmount, "Starting amount");
    if ("error" in startingAmount) nextErrors.startingAmount = startingAmount.error;
    else parsed.startingAmountMinor = startingAmount.value;

    const monthlyContribution = parseRequiredNairaToMinor(values.monthlyContribution, "Monthly contribution");
    if ("error" in monthlyContribution) nextErrors.monthlyContribution = monthlyContribution.error;
    else parsed.monthlyContributionMinor = monthlyContribution.value;

    const investmentPeriod = parseInvestmentPeriodMonths(values.investmentPeriod);
    if ("error" in investmentPeriod) nextErrors.investmentPeriod = investmentPeriod.error;
    else parsed.months = investmentPeriod.value;

    const annualReturn = parseAnnualReturnPercent(values.annualReturn);
    if ("error" in annualReturn) nextErrors.annualReturn = annualReturn.error;
    else parsed.annualReturnPercent = annualReturn.value;

    const annualManagementFee = parseAnnualManagementFeePercent(values.annualManagementFee);
    if ("error" in annualManagementFee) nextErrors.annualManagementFee = annualManagementFee.error;
    else parsed.annualManagementFeePercent = annualManagementFee.value;

    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    try {
      setResult(calculateReturnsProjection(parsed));
    } catch (error) {
      setResult(null);
      setFormError(error instanceof RangeError ? error.message : "We could not calculate this projection safely. Please review the figures.");
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] lg:gap-10">
      <form noValidate onSubmit={handleSubmit} className="rounded-2xl border border-star-200 bg-white p-6 shadow-[0_4px_16px_rgba(0,59,42,0.035)] sm:p-8 lg:p-9">
        <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Projection inputs</p>
        <h2 id="returns-inputs-heading" className="mt-3 font-display text-[1.7rem] font-bold tracking-[-0.035em] text-star-900">Set your assumptions</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-star-muted">Model a starting amount, regular contributions and your own illustrative return and fee assumptions.</p>

        <div className="mt-8 grid gap-6" aria-labelledby="returns-inputs-heading">
          {fields.map((field) => <NumberInput key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={updateValue} />)}
        </div>

        {formError ? <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{formError}</p> : null}
        <button type="submit" className="mt-9 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-bold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:w-auto sm:min-w-56">
          Project my returns
        </button>
      </form>

      <aside className="lg:sticky lg:top-24">
        <section className="rounded-2xl border border-star-200 bg-[#f3f6f1] p-6 sm:p-7" aria-labelledby="returns-results-heading" aria-live="polite" aria-atomic="true">
          {result ? <CalculatedResults result={result} /> : <InitialResults />}
        </section>
        <p className="mt-5 border-t border-star-200 pt-5 text-xs leading-5 text-star-muted">
          Projections are illustrations based entirely on the assumptions you enter — they are not forecasts, promises or indications of any Starfetch product&apos;s performance. Investment values can fall as well as rise. Figures compound monthly and ignore taxes.
        </p>
      </aside>
    </div>
  );
}

function NumberInput({ field, value, error, onChange }: { field: FieldDefinition; value: string; error?: string; onChange: (key: ReturnField, value: string) => void }) {
  const id = `returns-${field.key}`;
  const errorId = `${id}-error`;
  const supportId = `${id}-support`;
  const descriptionIds = [field.supportingText ? supportId : "", error ? errorId : ""].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-star-900">{field.label}</label>
      <input
        id={id}
        name={field.key}
        type="number"
        min={field.min}
        max={field.max}
        step={field.step}
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(field.key, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={descriptionIds}
        className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/70 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`}
      />
      {field.supportingText ? <p id={supportId} className="mt-2 text-xs leading-5 text-star-muted">{field.supportingText}</p> : null}
      {error ? <p id={errorId} role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

function InitialResults() {
  return (
    <>
      <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Projection results</p>
      <h2 id="returns-results-heading" className="mt-3 font-display text-[1.65rem] font-bold leading-tight tracking-[-0.035em] text-star-900">Your projection appears here</h2>
      <p className="mt-4 text-sm leading-7 text-star-muted">Set your amounts and assumptions, then press Project my returns.</p>
    </>
  );
}

function CalculatedResults({ result }: { result: ReturnsProjection }) {
  const hasLoss = result.projectedGainLossMinor < 0;
  const gainLossValue = formatProjectionNairaMinor(result.projectedGainLossMinor);
  const gainLossDisplay = hasLoss ? gainLossValue : `+${gainLossValue}`;
  const breakdownMaximum = Math.max(
    Math.abs(result.startingAmountMinor),
    Math.abs(result.additionalContributionsMinor),
    Math.abs(result.projectedGainLossMinor),
    Math.abs(result.projectedFinalBalanceMinor),
    1,
  );

  return (
    <>
      <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Projection results</p>
      <h2 id="returns-results-heading" className="mt-3 font-display text-[1.65rem] font-bold leading-tight tracking-[-0.035em] text-star-900">Your projected outcome</h2>
      <p className="mt-2 text-xs leading-5 text-star-muted">{result.months} monthly compounding step{result.months === 1 ? "" : "s"}; contributions are added at the end of each month.</p>

      <dl className="mt-6 divide-y divide-star-200 rounded-xl border border-star-200 bg-white px-4 sm:px-5">
        <ResultRow label="Starting investment" value={formatProjectionNairaMinor(result.startingAmountMinor)} />
        <ResultRow label="Total contributed" value={formatProjectionNairaMinor(result.totalContributedMinor)} />
        <ResultRow label="Projected value before fees" value={formatProjectionNairaMinor(result.projectedBeforeFeesMinor)} />
        <ResultRow label="Estimated management fees" value={formatProjectionNairaMinor(result.estimatedManagementFeesMinor)} />
      </dl>

      <section className="mt-5 rounded-xl bg-star-900 px-5 py-5 text-white" aria-label="Projected final balance">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-star-lime">Projected final balance</p>
        <p className="mt-2 font-display text-[clamp(1.8rem,5vw,2.5rem)] font-bold leading-none tracking-[-0.045em] tabular-nums">{formatProjectionNairaMinor(result.projectedFinalBalanceMinor)}</p>
        <p className={`mt-3 text-sm font-semibold ${hasLoss ? "text-[#ffc6c6]" : "text-star-lime"}`}>Projected gain or loss: {gainLossDisplay}</p>
      </section>

      <section className="mt-7 border-t border-star-200 pt-6" aria-labelledby="growth-breakdown-heading">
        <h3 id="growth-breakdown-heading" className="text-base font-bold text-star-900">Growth breakdown</h3>
        <p className="mt-2 text-xs leading-5 text-star-muted">A simple illustration of contributions, projected gain or loss and the final balance after the assumed monthly fee.</p>
        <div className="mt-4 grid gap-3">
          <BreakdownBar label="Starting amount" value={result.startingAmountMinor} maximum={breakdownMaximum} colorClass="bg-star-700" />
          <BreakdownBar label="Additional contributions" value={result.additionalContributionsMinor} maximum={breakdownMaximum} colorClass="bg-star-limeDark" />
          <BreakdownBar label={hasLoss ? "Projected loss" : "Projected gain"} value={Math.abs(result.projectedGainLossMinor)} maximum={breakdownMaximum} colorClass={hasLoss ? "bg-red-500" : "bg-star-lime"} signedValue={result.projectedGainLossMinor} />
          <BreakdownBar label="Projected final balance" value={result.projectedFinalBalanceMinor} maximum={breakdownMaximum} colorClass="bg-star-900" prominent />
        </div>
      </section>
    </>
  );
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-4 last:pb-4">
      <dt className="text-sm leading-5 text-star-muted">{label}</dt>
      <dd className="shrink-0 text-right text-base font-bold tabular-nums text-star-900">{value}</dd>
    </div>
  );
}

function BreakdownBar({ label, value, maximum, colorClass, signedValue, prominent = false }: { label: string; value: number; maximum: number; colorClass: string; signedValue?: number; prominent?: boolean }) {
  const denominator = Math.max(Math.abs(maximum), Math.abs(value), 1);
  const width = Math.max(4, Math.min(100, (Math.abs(value) / denominator) * 100));
  const displayedValue = signedValue !== undefined && signedValue > 0 ? `+${formatProjectionNairaMinor(signedValue)}` : formatProjectionNairaMinor(signedValue ?? value);

  return (
    <div className={`rounded-lg border border-star-200 bg-white px-4 py-3 ${prominent ? "ring-1 ring-star-200" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-star-muted">{label}</p>
        <p className={`shrink-0 text-right text-sm font-bold tabular-nums ${signedValue !== undefined && signedValue < 0 ? "text-red-700" : "text-star-900"}`}>{displayedValue}</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-star-100" aria-hidden="true">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
