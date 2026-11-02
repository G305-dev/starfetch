import { Check } from "lucide-react";
import { corporateOnboardingSteps } from "./corporate-onboarding-data";

export function CorporateOnboardingStepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="mx-auto mt-7 max-w-2xl" aria-label={`Step ${currentStep} of 3`}>
      <p className="text-center text-xs font-bold text-star-700">Step {currentStep} of 3</p>
      <ol className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
        {corporateOnboardingSteps.map(({ number, label }) => {
          const complete = number < currentStep;
          const active = number === currentStep;
          return (
            <li key={number} className="relative min-w-0 text-center">
              {number !== 1 ? <span className={`absolute right-1/2 top-4 h-px w-full -translate-y-1/2 ${complete || active ? "bg-star-lime" : "bg-star-200"}`} aria-hidden="true" /> : null}
              <span className={`relative z-10 mx-auto grid h-8 w-8 place-items-center rounded-full border text-xs font-extrabold ${complete ? "border-star-700 bg-star-700 text-white" : active ? "border-star-lime bg-star-lime text-star-900" : "border-star-200 bg-white text-star-muted"}`}>{complete ? <Check size={15} strokeWidth={3} aria-label="Complete" /> : number}</span>
              <span className={`mt-2 block truncate text-[0.62rem] font-bold uppercase tracking-[0.07em] sm:text-[0.68rem] ${active || complete ? "text-star-700" : "text-star-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
