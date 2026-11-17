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

/** Bank details are sent only to the owner-scoped Individual KYC API; raw BVN and routing codes are never requested. */
export function BankDetailsDraft({ value, onChange, accountNumberMasked = null }: { value: BankDetailsDraftValue; onChange: (value: BankDetailsDraftValue) => void; accountNumberMasked?: string | null }) {
  const update = <K extends keyof BankDetailsDraftValue>(key: K, next: BankDetailsDraftValue[K]) => onChange({ ...value, [key]: next });

  return (
    <section className="mt-7 overflow-hidden rounded-xl border border-star-200 bg-white shadow-[0_2px_12px_rgba(14,62,46,0.04)]" aria-labelledby="bank-details-heading">
      <div className="bg-star-700 px-5 py-4 sm:px-6">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-star-lime">Saved KYC section</p>
        <h2 id="bank-details-heading" className="mt-1 text-xl font-extrabold text-white">Bank Details</h2>
      </div>
      <div className="p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm font-extrabold text-star-900">Bank name <span aria-hidden="true">*</span></span><input type="text" autoComplete="off" value={value.bankName} onChange={(event) => update("bankName", event.target.value)} placeholder="Enter bank name" className={`mt-2 ${inputClassName()}`} /></label>
          <label className="block">
            <span className="text-sm font-extrabold text-star-900">Account number (NUBAN) <span aria-hidden="true">*</span></span>
            <input type="text" inputMode="numeric" autoComplete="off" maxLength={10} pattern="[0-9]{10}" value={value.accountNumber} onChange={(event) => update("accountNumber", event.target.value)} placeholder="Enter 10-digit account number" className={`mt-2 ${inputClassName()}`} />
            {accountNumberMasked ? <span className="mt-1 block text-xs leading-5 text-star-muted">Saved account: <strong className="text-star-700">{accountNumberMasked}</strong>. The full number is not returned; re-enter all 10 digits to save Bank Details.</span> : <span className="mt-1 block text-xs leading-5 text-star-muted">Enter exactly 10 digits. The saved account number will be masked when you return.</span>}
          </label>
          <label className="block"><span className="text-sm font-extrabold text-star-900">Account name <span aria-hidden="true">*</span></span><input type="text" autoComplete="off" value={value.accountName} onChange={(event) => update("accountName", event.target.value)} placeholder="Enter account name" className={`mt-2 ${inputClassName()}`} /></label>
          <label className="block"><span className="text-sm font-extrabold text-star-900">Account type <span aria-hidden="true">*</span></span><input type="text" autoComplete="off" value={value.accountType} onChange={(event) => update("accountType", event.target.value)} placeholder="Enter account type" className={`mt-2 ${inputClassName()}`} /></label>
          <label className="block sm:col-span-2"><span className="text-sm font-extrabold text-star-900">BVN linked to account <span aria-hidden="true">*</span></span><select value={value.bvnLinkedToAccount} onChange={(event) => update("bvnLinkedToAccount", event.target.value)} className={`mt-2 ${inputClassName()}`}><option value="">Select confirmation</option><option value="yes">Yes</option><option value="no">No</option></select><span className="mt-1 block text-xs leading-5 text-star-muted">This is your declaration only. No BVN number is requested or checked here.</span></label>
        </div>
      </div>
    </section>
  );
}
