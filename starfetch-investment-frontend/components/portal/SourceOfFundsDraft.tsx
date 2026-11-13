"use client";

const sourceOfFundsOptions = ["Salary / employment", "Business income", "Sale of assets", "Inheritance / gift", "Savings", "Pension / retirement", "Investment proceeds", "Other (specify)"] as const;

export type SourceOfFundsDraftValue = {
  selectedSources: string[];
  otherSource: string;
  expectedAnnualInflow: string;
  expectedTransactionFrequency: string;
};

export function emptySourceOfFundsDraft(): SourceOfFundsDraftValue {
  return { selectedSources: [], otherSource: "", expectedAnnualInflow: "", expectedTransactionFrequency: "" };
}

function inputClassName() {
  return "min-h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100";
}

/** Current-page source-of-funds draft only; it has no AML/CFT submission or assessment workflow. */
export function SourceOfFundsDraft({ value, onChange }: { value: SourceOfFundsDraftValue; onChange: (value: SourceOfFundsDraftValue) => void }) {
  const toggleSource = (source: string, checked: boolean) => onChange({ ...value, selectedSources: checked ? [...value.selectedSources, source] : value.selectedSources.filter((current) => current !== source) });

  return <section className="mt-7 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="source-of-funds-heading"><div className="bg-star-700 px-5 py-4 sm:px-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-lime">Current-page draft</p><h2 id="source-of-funds-heading" className="mt-1 text-xl font-extrabold text-white">Source of Funds and Wealth <span className="font-semibold text-star-lime">— AML/CFT</span></h2></div><div className="p-5 sm:p-6"><p className="text-sm leading-6 text-star-muted">Use this current-page draft to review the source of funds for a future approved workflow. It is not submitted, stored, screened, assessed, or retained after you leave or refresh this page because an approved AML/CFT backend workflow is not available.</p><fieldset className="mt-6"><legend className="mb-2 text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />Source of funds to be invested</legend><div className="grid overflow-hidden rounded-md border border-star-200 sm:grid-cols-2 lg:grid-cols-4">{sourceOfFundsOptions.map((source) => <label key={source} className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-star-100 px-3 text-sm text-star-700 transition hover:bg-star-50 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(4n)]:border-r-0"><input type="checkbox" checked={value.selectedSources.includes(source)} onChange={(event) => toggleSource(source, event.target.checked)} className="size-4 rounded accent-star-700" />{source}</label>)}</div></fieldset><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">If other, specify</span><input type="text" value={value.otherSource} onChange={(event) => onChange({ ...value, otherSource: event.target.value })} placeholder="Specify another source of funds" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Expected annual inflow (₦)</span><input type="text" inputMode="decimal" value={value.expectedAnnualInflow} onChange={(event) => onChange({ ...value, expectedAnnualInflow: event.target.value })} placeholder="Enter expected annual inflow" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Expected transaction frequency</span><input type="text" value={value.expectedTransactionFrequency} onChange={(event) => onChange({ ...value, expectedTransactionFrequency: event.target.value })} placeholder="Enter expected frequency" className={`mt-2 ${inputClassName()}`} /></label></div></div></section>;
}
