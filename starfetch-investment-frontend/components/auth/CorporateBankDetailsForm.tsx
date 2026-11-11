import { Landmark } from "lucide-react";

/** Bank details are outside the approved six-field Corporate O2 draft contract. */
export function CorporateBankDetailsForm() {
  return <section className="rounded-xl border border-star-200 bg-star-50 p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700"><Landmark size={20} aria-hidden="true" /></span><div><h3 className="text-base font-extrabold text-star-900">Bank details are not requested</h3><p className="mt-1 text-sm leading-6 text-star-muted">Settlement-bank information is not part of the approved Corporate draft contract and will be requested only through a future approved backend workflow.</p></div></div></section>;
}
