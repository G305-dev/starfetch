import { CheckCircle2 } from "lucide-react";
import { corporateMandates, type CorporateFieldErrors, type CorporateMandateId } from "./corporate-onboarding-data";

type Props = {
  selectedMandate: CorporateMandateId | "";
  error?: CorporateFieldErrors["selectedMandate"];
  onSelect: (mandate: CorporateMandateId) => void;
};

export function MandateSelectionForm({ selectedMandate, error, onSelect }: Props) {
  return (
    <fieldset>
      <legend className="sr-only">Choose an investment mandate</legend>
      <div className="grid gap-4">
        {corporateMandates.map((mandate) => {
          const selected = selectedMandate === mandate.id;
          return (
            <label key={mandate.id} className={`group flex cursor-pointer items-start gap-4 rounded-xl border p-5 transition sm:p-6 ${selected ? "border-star-lime bg-star-50 shadow-[0_7px_18px_rgba(0,59,42,0.06)]" : "border-star-200 bg-white hover:border-star-300 hover:bg-star-50/60"}`}>
              <input type="radio" name="selectedMandate" value={mandate.id} checked={selected} onChange={() => onSelect(mandate.id)} className="sr-only" />
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border ${selected ? "border-star-700 bg-star-700 text-white" : "border-star-200 bg-white text-transparent group-hover:border-star-300"}`} aria-hidden="true"><CheckCircle2 size={16} strokeWidth={3} /></span>
              <span><span className="block text-base font-extrabold text-star-900">{mandate.title}</span><span className="mt-2 block text-sm leading-6 text-star-muted">{mandate.description}</span></span>
            </label>
          );
        })}
      </div>
      {error ? <p role="alert" className="mt-3 text-xs font-medium text-red-700">{error}</p> : null}
    </fieldset>
  );
}
