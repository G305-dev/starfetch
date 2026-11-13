"use client";

export type BankDetailsDraftValue = {
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: string;
};

export function emptyBankDetailsDraft(): BankDetailsDraftValue {
  return { bankName: "", accountNumber: "", accountName: "", accountType: "", bvnLinkedToAccount: "" };
}

function inputClassName() {
  return "min-h-11 w-full rounded-md border border-star-200 bg-white px-3 text-sm font-semibold text-star-900 outline-none transition focus:border-star-700 focus:ring-2 focus:ring-star-100";
}

/**
 * Current-page banking draft only. It omits legacy bank-routing-location
 * details and any BVN number, and makes no request until an approved
 * bank-details API and withdrawals workflow are supplied.
 */
export function BankDetailsDraft({ value, onChange }: { value: BankDetailsDraftValue; onChange: (value: BankDetailsDraftValue) => void }) {
  const update = <K extends keyof BankDetailsDraftValue>(key: K, next: BankDetailsDraftValue[K]) => onChange({ ...value, [key]: next });

  return <section className="mt-7 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="bank-details-heading"><div className="bg-star-700 px-5 py-4 sm:px-6"><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-lime">Current-page draft</p><h2 id="bank-details-heading" className="mt-1 text-xl font-extrabold text-white">Bank Details</h2></div><div className="p-5 sm:p-6"><p className="text-sm italic leading-6 text-star-muted">For a future approved withdrawals and distributions workflow, the settlement account must be held in the applicant&apos;s own name. Third-party payments are not permitted.</p><p className="mt-2 text-sm leading-6 text-star-muted">These details are not submitted, stored, validated, or retained after you leave or refresh this page. Do not enter a BVN number; the portal only asks for a local confirmation that the account is BVN-linked.</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="block"><span className="text-sm font-extrabold text-star-900">Bank name <span aria-hidden="true">*</span></span><input type="text" autoComplete="off" value={value.bankName} onChange={(event) => update("bankName", event.target.value)} placeholder="Enter bank name" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Account number (NUBAN) <span aria-hidden="true">*</span></span><input type="text" inputMode="numeric" autoComplete="off" value={value.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} placeholder="Enter account number" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Account name <span aria-hidden="true">*</span></span><input type="text" autoComplete="off" value={value.accountName} onChange={(event) => update("accountName", event.target.value)} placeholder="Enter account name" className={`mt-2 ${inputClassName()}`} /></label><label className="block"><span className="text-sm font-extrabold text-star-900">Account type</span><input type="text" autoComplete="off" value={value.accountType} onChange={(event) => update("accountType", event.target.value)} placeholder="Enter account type" className={`mt-2 ${inputClassName()}`} /></label><label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">BVN linked to account <span aria-hidden="true">*</span></span><select value={value.bvnLinkedToAccount} onChange={(event) => update("bvnLinkedToAccount", event.target.value)} className={`mt-2 ${inputClassName()}`}><option value="">Select confirmation</option><option value="yes">Yes</option><option value="no">No</option></select></label></div></div></section>;
}
