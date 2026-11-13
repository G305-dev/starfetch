"use client";

export type PepDeclarationDraftValue = {
  applicantPepStatus: string;
  details: string;
};

export function emptyPepDeclarationDraft(): PepDeclarationDraftValue {
  return { applicantPepStatus: "", details: "" };
}

function inputClassName() {
  return "min-h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100";
}

/** Current-page PEP declaration draft only; it has no compliance API or assessment. */
export function PepDeclarationDraft({ value, onChange }: { value: PepDeclarationDraftValue; onChange: (value: PepDeclarationDraftValue) => void }) {
  return <section className="mt-7 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="pep-declaration-heading"><div className="bg-star-700 px-5 py-4 sm:px-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-lime">Current-page declaration draft</p><h2 id="pep-declaration-heading" className="mt-1 text-xl font-extrabold text-white">Politically Exposed Person (PEP) Declaration</h2></div><div className="p-5 sm:p-6"><p className="text-sm leading-6 text-star-muted">Are you, or have you or any of your close relatives or associates within the last 12 months, occupied a prominent public position?</p><fieldset className="mt-5"><legend className="sr-only">PEP declaration</legend><div className="grid overflow-hidden rounded-md border border-star-200 sm:grid-cols-2"><label className="flex min-h-11 cursor-pointer items-center gap-2 border-b border-star-100 px-3 text-sm font-semibold text-star-700 transition hover:bg-star-50 sm:border-b-0 sm:border-r"><input type="radio" name="applicant-pep-status" value="yes" checked={value.applicantPepStatus === "yes"} onChange={(event) => onChange({ ...value, applicantPepStatus: event.target.value })} className="size-4 accent-star-700" />Yes</label><label className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold text-star-700 transition hover:bg-star-50"><input type="radio" name="applicant-pep-status" value="no" checked={value.applicantPepStatus === "no"} onChange={(event) => onChange({ ...value, applicantPepStatus: event.target.value })} className="size-4 accent-star-700" />No</label></div></fieldset><label className="mt-5 block"><span className="text-sm font-extrabold text-star-900"><span className="mr-2 inline-block size-2 bg-[#c9a227]" aria-hidden="true" />If yes, give details (name, position, country, period held)</span><textarea rows={4} value={value.details} onChange={(event) => onChange({ ...value, details: event.target.value })} placeholder="Enter details if applicable" className={`mt-2 ${inputClassName()} py-3`} /></label></div></section>;
}
