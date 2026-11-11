import { UserRound } from "lucide-react";

/**
 * The Corporate O2 contract has no additional representative fields. The
 * authenticated initiating applicant is shown for review without collecting or
 * persisting a duplicate personal profile.
 */
export function CorporatePersonalInformationForm({ fullName, email }: { fullName: string; email: string }) {
  return (
    <section className="rounded-xl border border-star-200 bg-star-50 p-5" aria-labelledby="corporate-initiating-applicant-heading">
      <div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700"><UserRound size={20} aria-hidden="true" /></span><div><h3 id="corporate-initiating-applicant-heading" className="text-base font-extrabold text-star-900">Initiating applicant</h3><p className="mt-1 text-sm leading-6 text-star-muted">This application is associated with the signed-in investor. Additional representative fields will be shown only when approved by the Corporate backend contract.</p></div></div>
      <dl className="mt-4 grid gap-4 border-t border-star-200 pt-4 sm:grid-cols-2"><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Name</dt><dd className="mt-1 text-sm font-semibold text-star-700">{fullName}</dd></div><div><dt className="text-xs font-bold uppercase tracking-[0.06em] text-star-muted">Email</dt><dd className="mt-1 break-all text-sm font-semibold text-star-700">{email}</dd></div></dl>
    </section>
  );
}
