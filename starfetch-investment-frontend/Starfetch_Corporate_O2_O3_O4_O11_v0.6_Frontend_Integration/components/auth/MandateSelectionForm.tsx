import { BriefcaseBusiness } from "lucide-react";

/** Mandate selection remains unavailable until a public Corporate workflow approves it. */
export function MandateSelectionForm() {
  return <section className="rounded-xl border border-star-200 bg-star-50 p-5"><div className="flex gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-star-700"><BriefcaseBusiness size={20} aria-hidden="true" /></span><div><h3 className="text-base font-extrabold text-star-900">Mandate selection is unavailable</h3><p className="mt-1 text-sm leading-6 text-star-muted">No corporate mandate is collected or selected locally while the approved Corporate application workflow is unavailable.</p></div></div></section>;
}
