"use client";

type ChoiceRowProps = {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
};

export type InvestmentObjectiveRiskDraft = {
  primaryObjective: string;
  riskTolerance: string;
  investmentHorizon: string;
  knowledgeAndExperience: string;
  expectedWithdrawals: string;
  withdrawalFrequency: string;
  annualIncome: string;
  estimatedNetWorth: string;
  restrictionsOrExclusions: string;
};

export function emptyInvestmentObjectiveRiskDraft(): InvestmentObjectiveRiskDraft {
  return {
    primaryObjective: "",
    riskTolerance: "",
    investmentHorizon: "",
    knowledgeAndExperience: "",
    expectedWithdrawals: "",
    withdrawalFrequency: "",
    annualIncome: "",
    estimatedNetWorth: "",
    restrictionsOrExclusions: "",
  };
}

function inputClassName() {
  return "min-h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100";
}

function ChoiceRow({ label, name, options, value, onChange }: ChoiceRowProps) {
  return <fieldset><legend className="mb-2 text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />{label}</legend><div className="grid overflow-hidden rounded-md border border-star-200 sm:grid-cols-2 lg:grid-cols-4">{options.map((option) => <label key={option} className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-star-100 px-3 text-sm text-star-700 transition hover:bg-star-50 sm:border-b-0 sm:border-r last:border-r-0"><input type="radio" name={name} value={option} checked={value === option} onChange={(event) => onChange(event.target.value)} className="size-4 accent-star-700" />{option}</label>)}</div></fieldset>;
}

/**
 * Current-page planning draft only. It intentionally has no API call or browser
 * persistence until an approved suitability/KYC backend contract is supplied.
 */
export function InvestmentObjectiveRiskProfileDraft({ value, onChange }: { value: InvestmentObjectiveRiskDraft; onChange: (value: InvestmentObjectiveRiskDraft) => void }) {
  const update = <K extends keyof InvestmentObjectiveRiskDraft>(key: K, next: InvestmentObjectiveRiskDraft[K]) => onChange({ ...value, [key]: next });

  return <section className="mt-7 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="investment-objective-risk-heading"><div className="bg-star-700 px-5 py-4 sm:px-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-lime">Investor suitability draft</p><h2 id="investment-objective-risk-heading" className="mt-1 text-xl font-extrabold text-white">Investment Objective and Risk Profile</h2></div><div className="p-5 sm:p-6"><p className="text-sm leading-6 text-star-muted">Use this current-page draft to review your investment preferences. These details are not submitted, saved, assessed, or retained after you leave or refresh this page because an approved suitability backend workflow is not available.</p><div className="mt-6 space-y-5"><ChoiceRow label="Primary investment objective" name="primary-investment-objective" options={["Capital preservation", "Income", "Balanced", "Growth"]} value={value.primaryObjective} onChange={(next) => update("primaryObjective", next)} /><ChoiceRow label="Risk tolerance" name="risk-tolerance" options={["Conservative", "Moderate", "Balanced", "Aggressive"]} value={value.riskTolerance} onChange={(next) => update("riskTolerance", next)} /><ChoiceRow label="Investment horizon" name="investment-horizon" options={["180 days", "365 days", "1–3 years", "3–5 years", "5 years +"]} value={value.investmentHorizon} onChange={(next) => update("investmentHorizon", next)} /><ChoiceRow label="Investment knowledge and experience" name="investment-knowledge-experience" options={["None", "Limited", "Good", "Extensive"]} value={value.knowledgeAndExperience} onChange={(next) => update("knowledgeAndExperience", next)} /><div className="grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Expected withdrawals</span><input type="text" value={value.expectedWithdrawals} onChange={(event) => update("expectedWithdrawals", event.target.value)} placeholder="Enter expected withdrawals" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Frequency</span><input type="text" value={value.withdrawalFrequency} onChange={(event) => update("withdrawalFrequency", event.target.value)} placeholder="Enter frequency" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Annual income (₦)</span><input type="text" inputMode="decimal" value={value.annualIncome} onChange={(event) => update("annualIncome", event.target.value)} placeholder="Enter annual income" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Estimated net worth (₦)</span><input type="text" inputMode="decimal" value={value.estimatedNetWorth} onChange={(event) => update("estimatedNetWorth", event.target.value)} placeholder="Enter estimated net worth" className={`mt-2 ${inputClassName()}`} /></label></div><label className="block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Investment restrictions or exclusions (if any)</span><textarea rows={4} value={value.restrictionsOrExclusions} onChange={(event) => update("restrictionsOrExclusions", event.target.value)} placeholder="Enter any investment restrictions or exclusions" className={`mt-2 ${inputClassName()} py-3`} /></label></div></div></section>;
}
