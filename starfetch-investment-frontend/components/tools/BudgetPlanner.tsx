"use client";

import { type FormEvent, useState } from "react";
import {
  calculateBudget,
  formatNairaMinor,
  formatPercentage,
  parseNairaToMinor,
  type BudgetAmounts,
  type BudgetResult,
} from "@/lib/tools/budget";

type BudgetField = keyof BudgetAmounts;
type FormValues = Record<BudgetField, string>;
type FormErrors = Partial<Record<BudgetField, string>>;

type FieldDefinition = {
  key: BudgetField;
  label: string;
  placeholder?: string;
};

const incomeFields: FieldDefinition[] = [
  { key: "takeHomeIncome", label: "Take-home income (₦)", placeholder: "e.g. 850000" },
  { key: "otherIncome", label: "Other income (₦)", placeholder: "e.g. 150000" },
];

const spendingFields: FieldDefinition[] = [
  { key: "housingUtilities", label: "Housing & utilities (₦)", placeholder: "rent, power, water, internet" },
  { key: "foodHousehold", label: "Food & household (₦)" },
  { key: "transportFuel", label: "Transport & fuel (₦)" },
  { key: "familySchoolSupport", label: "Family, school fees & support (₦)" },
  { key: "lifestyleSubscriptions", label: "Lifestyle & subscriptions (₦)" },
  { key: "loanDebtRepayments", label: "Loan & debt repayments (₦)" },
  { key: "everythingElse", label: "Everything else (₦)" },
];

const initialValues: FormValues = {
  takeHomeIncome: "",
  otherIncome: "",
  housingUtilities: "",
  foodHousehold: "",
  transportFuel: "",
  familySchoolSupport: "",
  lifestyleSubscriptions: "",
  loanDebtRepayments: "",
  everythingElse: "",
};

export function BudgetPlanner() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState<BudgetResult | null>(null);

  function updateValue(key: BudgetField, value: string) {
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
    const parsedAmounts = {} as BudgetAmounts;

    for (const field of [...incomeFields, ...spendingFields]) {
      const parsed = parseNairaToMinor(values[field.key]);
      if ("error" in parsed) {
        nextErrors[field.key] = parsed.error;
      } else {
        parsedAmounts[field.key] = parsed.valueMinor;
      }
    }

    setErrors(nextErrors);
    setFormError("");
    if (Object.keys(nextErrors).length > 0) {
      setResult(null);
      return;
    }

    try {
      setResult(calculateBudget(parsedAmounts));
    } catch (error) {
      setResult(null);
      setFormError(error instanceof RangeError ? error.message : "We could not calculate this budget safely. Please review the figures.");
    }
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.38fr)_minmax(300px,0.82fr)] lg:gap-10">
      <form noValidate onSubmit={handleSubmit} className="rounded-2xl border border-star-200 bg-white p-6 shadow-[0_4px_16px_rgba(0,59,42,0.035)] sm:p-8 lg:p-9">
        <section aria-labelledby="monthly-income-heading">
          <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Budget inputs</p>
          <h2 id="monthly-income-heading" className="mt-3 font-display text-[1.7rem] font-bold tracking-[-0.035em] text-star-900">Monthly income</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {incomeFields.map((field) => <MoneyInput key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={updateValue} />)}
          </div>
        </section>

        <section className="mt-10 border-t border-star-100 pt-9" aria-labelledby="monthly-spending-heading">
          <h2 id="monthly-spending-heading" className="font-display text-[1.7rem] font-bold tracking-[-0.035em] text-star-900">Monthly spending</h2>
          <p className="mt-2 text-sm leading-6 text-star-muted">Leave an expense blank if it does not apply; it will be treated as zero.</p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {spendingFields.map((field) => <MoneyInput key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={updateValue} />)}
          </div>
        </section>

        {formError ? <p role="alert" className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{formError}</p> : null}
        <button type="submit" className="mt-9 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-star-lime px-5 text-sm font-bold text-star-900 transition hover:bg-[#c7f238] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-star-700 focus-visible:ring-offset-2 sm:w-auto sm:min-w-56">
          Calculate my budget
        </button>
      </form>

      <aside className="lg:sticky lg:top-24">
        <section className="rounded-2xl border border-star-200 bg-[#f3f6f1] p-6 sm:p-7" aria-labelledby="budget-results-heading" aria-live="polite" aria-atomic="true">
          {result ? <CalculatedResults result={result} /> : <InitialResults />}
        </section>
        <p className="mt-5 border-t border-star-200 pt-5 text-xs leading-5 text-star-muted">
          Illustrative planning tool only; not financial advice. The 50/30/20 guideline (needs/wants/savings) is a rule of thumb, not a rule.
        </p>
      </aside>
    </div>
  );
}

function MoneyInput({ field, value, error, onChange }: { field: FieldDefinition; value: string; error?: string; onChange: (key: BudgetField, value: string) => void }) {
  const id = `budget-${field.key}`;
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-star-900">{field.label}</label>
      <input
        id={id}
        name={field.key}
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        placeholder={field.placeholder}
        onChange={(event) => onChange(field.key, event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`h-12 w-full rounded-lg border bg-white px-3.5 text-sm text-star-900 outline-none transition placeholder:text-star-muted/70 focus:border-star-700 focus:ring-2 focus:ring-star-100 ${error ? "border-red-500 focus:border-red-600 focus:ring-red-100" : "border-star-200"}`}
      />
      {error ? <p id={errorId} role="alert" className="mt-2 text-xs leading-5 text-red-700">{error}</p> : null}
    </div>
  );
}

function InitialResults() {
  return (
    <>
      <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Budget summary</p>
      <h2 id="budget-results-heading" className="mt-3 font-display text-[1.65rem] font-bold leading-tight tracking-[-0.035em] text-star-900">Your results appear here</h2>
      <p className="mt-4 text-sm leading-7 text-star-muted">Fill in the figures and press Calculate my budget. Tip: use averages from your last three months of bank statements for a realistic picture.</p>
    </>
  );
}

function CalculatedResults({ result }: { result: BudgetResult }) {
  const hasPositiveBalance = result.balanceMinor > 0;
  const hasShortfall = result.balanceMinor < 0;
  const balanceLabel = hasPositiveBalance ? "Remaining balance / potential savings" : hasShortfall ? "Monthly shortfall" : "Remaining monthly balance";
  const balanceValue = hasShortfall ? formatNairaMinor(Math.abs(result.balanceMinor)) : formatNairaMinor(result.balanceMinor);
  const interpretation = hasPositiveBalance
    ? "Your recorded expenses are below your recorded income. This remaining amount is not a confirmed saving."
    : hasShortfall
      ? "Your recorded expenses exceed your recorded income. Review the figures and consider where adjustments may be possible."
      : "Your recorded expenses equal your recorded income.";

  return (
    <>
      <p className="text-[0.63rem] font-bold uppercase tracking-[0.18em] text-star-700">Budget summary</p>
      <h2 id="budget-results-heading" className="mt-3 font-display text-[1.65rem] font-bold leading-tight tracking-[-0.035em] text-star-900">Your monthly picture</h2>

      <dl className="mt-6 divide-y divide-star-200 rounded-xl border border-star-200 bg-white px-4 sm:px-5">
        <ResultRow label="Total monthly income" value={formatNairaMinor(result.totalIncomeMinor)} />
        <ResultRow label="Total monthly spending" value={formatNairaMinor(result.totalSpendingMinor)} />
        <ResultRow label={balanceLabel} value={balanceValue} emphasis tone={hasShortfall ? "shortfall" : "positive"} />
        <ResultRow label="Recorded spending as a share of income" value={formatPercentage(result.spendingPercentage)} />
      </dl>
      {result.spendingPercentage === null ? <p className="mt-3 text-xs leading-5 text-star-muted">Recorded spending cannot be shown as a percentage because total monthly income is zero.</p> : null}

      <section className="mt-7 border-t border-star-200 pt-6" aria-labelledby="guideline-heading">
        <h3 id="guideline-heading" className="text-base font-bold text-star-900">Suggested 50/30/20 monthly targets</h3>
        <p className="mt-2 text-xs leading-5 text-star-muted">Illustrative targets based on the income you entered; they are not a verified needs-versus-wants breakdown.</p>
        <dl className="mt-4 grid gap-3">
          <ResultRow label="50% — Needs" value={formatNairaMinor(result.guidelineNeedsMinor)} compact />
          <ResultRow label="30% — Wants" value={formatNairaMinor(result.guidelineWantsMinor)} compact />
          <ResultRow label="20% — Savings and debt repayment" value={formatNairaMinor(result.guidelineSavingsDebtMinor)} compact />
        </dl>
      </section>

      <p className="mt-7 rounded-xl bg-white/75 px-4 py-3 text-sm leading-6 text-star-muted">{interpretation}</p>
    </>
  );
}

function ResultRow({ label, value, emphasis = false, tone = "neutral", compact = false }: { label: string; value: string; emphasis?: boolean; tone?: "neutral" | "positive" | "shortfall"; compact?: boolean }) {
  const valueClassName = tone === "shortfall" ? "text-red-700" : tone === "positive" ? "text-star-700" : "text-star-900";
  return (
    <div className={`flex items-start justify-between gap-4 ${compact ? "rounded-lg border border-star-200 bg-white px-4 py-3" : "py-4 first:pt-4 last:pb-4"}`}>
      <dt className={`${compact ? "text-xs" : "text-sm"} leading-5 text-star-muted`}>{label}</dt>
      <dd className={`${compact ? "text-sm" : "text-base"} shrink-0 text-right font-bold tabular-nums ${emphasis ? "font-extrabold" : ""} ${valueClassName}`}>{value}</dd>
    </div>
  );
}
